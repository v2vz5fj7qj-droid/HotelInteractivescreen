// ════════════════════════════════════════════════
//  ConnectBé — Flight Refresh Service
//  Utilisé par le scheduler automatique et l'endpoint admin
// ════════════════════════════════════════════════

const axios   = require('axios');
const cache   = require('./cacheService');
const db      = require('./db');
const { addCredits } = require('./creditTracker');

const THROTTLE_MS = 4000;
const MAX_ATTEMPTS = 3;
const CREDITS_PER_CALL = 2;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Erreurs réseau transitoires : DNS momentanément injoignable, connexion coupée, hôte
// temporairement inaccessible. Fréquent derrière une liaison instable (4G, partage de
// connexion) — c'est ce qui figeait les bornes pendant des jours sur une coupure d'une seconde.
const TRANSIENT_NET_CODES = new Set([
  'EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED',
  'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
]);

// FlightAPI masque sa limitation de débit derrière un 401 : on retente avec un délai croissant.
// Chaque requête qui atteint l'API est facturée, y compris celles qui répondent 401/429 ou
// qui expirent côté client : elles sont comptabilisées ici, sinon le compteur de crédits
// n'affiche qu'une fraction de la consommation réelle. Une panne DNS ou une connexion
// refusée n'atteint jamais l'API et ne coûte rien : elle n'est pas comptée.
async function fetchScheduleWithRetry(key, mode, airport) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await axios.get(`https://api.flightapi.io/compschedule/${key}`, {
        params: { mode, iata: airport, day: 0 },
        timeout: 30000,
      });
      await addCredits(CREDITS_PER_CALL);
      return response;
    } catch (e) {
      const throttled = e.response?.status === 401 || e.response?.status === 429;
      const timedOut  = e.code === 'ECONNABORTED';
      const netGlitch = TRANSIENT_NET_CODES.has(e.code);
      if (e.response || timedOut) await addCredits(CREDITS_PER_CALL);
      if ((!throttled && !timedOut && !netGlitch) || attempt >= MAX_ATTEMPTS) throw e;
      if (netGlitch) {
        console.warn(`[Flight Refresh] ${mode} (${airport}) — ${e.code}, tentative ${attempt}/${MAX_ATTEMPTS}`);
      }
      await sleep(THROTTLE_MS * attempt);
    }
  }
}

const STATUS_MAP = {
  'scheduled':    'scheduled',
  'estimated':    'scheduled',
  'active':       'active',
  'en route':     'active',
  'in flight':    'active',
  'airborne':     'active',
  'departed':     'active',
  'approaching':  'active',
  'landing':      'active',
  'landed':       'landed',
  'arrived':      'landed',
  'cancelled':    'cancelled',
  'canceled':     'cancelled',
  'annulé':       'cancelled',
  'delayed':      'delayed',
  'retardé':      'delayed',
  'diverted':     'diverted',
  'unknown':      'scheduled',
};

// FlightAPI expose le statut à deux endroits : un code normalisé sous
// status.generic.status.text ('landed', 'canceled'…) et un libellé lisible
// status.text qui porte l'heure ('Landed 14:51', 'Estimated 21:05').
// Une correspondance exacte sur le seul libellé échouait toujours et retombait sur
// 'scheduled' : tous les vols s'affichaient « prévu » quel que soit le nombre de
// rafraîchissements — les crédits partaient sans que l'écran change jamais.
function normalizeStatus(status) {
  const generic = typeof status === 'string' ? status : status?.generic?.status?.text;
  const label   = (generic || status?.text || '').toLowerCase().trim();
  if (!label) return status?.live === true ? 'active' : 'scheduled';
  if (STATUS_MAP[label]) return STATUS_MAP[label];
  // Libellé horodaté ou verbeux : on reconnaît le mot-clé de tête
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (label.startsWith(key)) return value;
  }
  return status?.live === true ? 'active' : 'scheduled';
}

// FlightAPI (schéma compschedule) ne renvoie pas de champ "delay" dédié :
// le retard se déduit de l'écart entre l'heure prévue et l'heure réelle/estimée (en secondes epoch).
function delayMinutes(scheduledTs, revisedTs) {
  if (!scheduledTs || !revisedTs) return 0;
  const diffMin = Math.round((revisedTs - scheduledTs) / 60);
  return diffMin > 0 ? diffMin : 0;
}

function normalizeFlightData(f) {
  const fl    = f?.flight || {};
  const toISO = (ts) => ts ? new Date(ts * 1000).toISOString() : null;

  const depScheduledTs = fl.time?.scheduled?.departure;
  const depRevisedTs   = fl.time?.real?.departure || fl.time?.estimated?.departure;
  const arrScheduledTs = fl.time?.scheduled?.arrival;
  const arrRevisedTs   = fl.time?.real?.arrival || fl.time?.estimated?.arrival;

  return {
    flight_number: fl.identification?.number?.default || 'N/A',
    airline:       fl.airline?.name || 'Compagnie inconnue',
    airline_icao:  fl.airline?.code?.icao || null,
    status:        normalizeStatus(fl.status),
    departure: {
      airport:   fl.airport?.origin?.name           || '',
      iata:      fl.airport?.origin?.code?.iata     || '',
      scheduled: toISO(depScheduledTs),
      estimated: toISO(fl.time?.estimated?.departure),
      actual:    toISO(fl.time?.real?.departure),
      terminal:  fl.airport?.origin?.info?.terminal || null,
      gate:      fl.airport?.origin?.info?.gate     || null,
      delay:     delayMinutes(depScheduledTs, depRevisedTs),
    },
    arrival: {
      airport:   fl.airport?.destination?.name           || '',
      iata:      fl.airport?.destination?.code?.iata     || '',
      scheduled: toISO(arrScheduledTs),
      estimated: toISO(fl.time?.estimated?.arrival),
      actual:    toISO(fl.time?.real?.arrival),
      terminal:  fl.airport?.destination?.info?.terminal || null,
      gate:      fl.airport?.destination?.info?.gate     || null,
      delay:     delayMinutes(arrScheduledTs, arrRevisedTs),
    },
  };
}

// L'aéroport est toujours fourni par l'appelant : la planification vit dans la table
// airports (back-office super-admin). Le repli sur l'environnement ne sert qu'aux
// appels sans code explicite.
async function refreshFlights(airportCode) {
  const FLIGHT_KEY = process.env.FLIGHTAPI_KEY;
  const airport = (airportCode || process.env.HOTEL_AIRPORT_IATA || 'OUA').toUpperCase();

  if (!FLIGHT_KEY) {
    await cache.delPattern(`flights:${airport}:*`);
    return { refreshed: 0, total: 0, airport, message: 'Clé API FlightAPI absente',
             errors: ['Clé API FlightAPI absente'] };
  }

  let refreshed = 0;
  let first = true;
  const errors = [];
  for (const type of ['arrivals', 'departures']) {
    try {
      // FlightAPI répond 401 (et non 429) quand deux appels s'enchaînent trop vite
      if (!first) await sleep(THROTTLE_MS);
      first = false;

      const response = await fetchScheduleWithRetry(FLIGHT_KEY, type, airport);
      const raw = response.data?.[0]?.airport?.pluginData?.schedule?.[type]?.data || [];
      const key = `flights:${airport}:${type}`;

      // FlightAPI renvoie par intermittence un 200 vide : ne pas effacer un cache déjà rempli
      if (raw.length === 0) {
        const previous = await cache.get(key);
        if (previous && JSON.parse(previous).flights?.length > 0) {
          console.warn(`[Flight Refresh] ${type} vide (${airport}) — anciennes données conservées`);
          errors.push(`${type} : réponse vide de FlightAPI — anciennes données conservées`);
          continue;
        }
      }

      const payload = {
        airport, type,
        flights:      raw.map(normalizeFlightData),
        refreshed_at: Date.now(),
        stale:        false,
      };
      // Stockage sans TTL : les données persistent même si le réseau tombe.
      // Redis injoignable = données payées mais jamais servies au kiosque : on le
      // signale au lieu de compter le sens comme rafraîchi.
      const stored = await cache.setPersist(key, JSON.stringify(payload));
      if (!stored) {
        console.warn(`[Flight Refresh] ${type} (${airport}) récupéré mais non publié — cache indisponible`);
        errors.push(`${type} : cache indisponible — données non publiées`);
        continue;
      }
      refreshed++;
    } catch (e) {
      // Réseau indisponible ou erreur API — on conserve les anciennes données sans toucher au
      // cache. L'échec est aussi remonté à l'appelant : un rafraîchissement qui n'a rien
      // récupéré ne doit pas être annoncé comme réussi.
      const detail = e.response?.status ? `HTTP ${e.response.status}` : (e.code || e.message);
      console.warn(`[Flight Refresh] ${type} échoué (${e.message}) — anciennes données conservées`);
      errors.push(`${type} : ${detail}`);
    }
  }

  console.log(`[Flights] Rafraîchissement : ${refreshed}/2 (${airport})`);
  return { refreshed, total: 2, airport, errors };
}

module.exports = {
  refreshFlights,
  refreshFlightsForAirport: refreshFlights,
  normalizeStatus,
  normalizeFlightData,
};
