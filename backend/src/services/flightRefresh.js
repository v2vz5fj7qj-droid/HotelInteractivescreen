// ════════════════════════════════════════════════
//  ConnectBé — Flight Refresh Service
//  Utilisé par le scheduler automatique et l'endpoint admin
// ════════════════════════════════════════════════

const axios   = require('axios');
const cache   = require('./cacheService');
const db      = require('./db');
const { addCredits } = require('./creditTracker');

let schedulerTimer = null;

const THROTTLE_MS = 4000;
const MAX_ATTEMPTS = 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Erreurs réseau transitoires : DNS momentanément injoignable, connexion coupée, hôte
// temporairement inaccessible. Fréquent derrière une liaison instable (4G, partage de
// connexion) — c'est ce qui figeait les bornes pendant des jours sur une coupure d'une seconde.
const TRANSIENT_NET_CODES = new Set([
  'EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED',
  'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
]);

// FlightAPI masque sa limitation de débit derrière un 401 : on retente avec un délai croissant
async function fetchScheduleWithRetry(key, mode, airport) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await axios.get(`https://api.flightapi.io/compschedule/${key}`, {
        params: { mode, iata: airport, day: 0 },
        timeout: 30000,
      });
    } catch (e) {
      const throttled = e.response?.status === 401 || e.response?.status === 429;
      const timedOut  = e.code === 'ECONNABORTED';
      const netGlitch = TRANSIENT_NET_CODES.has(e.code);
      if ((!throttled && !timedOut && !netGlitch) || attempt >= MAX_ATTEMPTS) throw e;
      if (netGlitch) {
        console.warn(`[Flight Refresh] ${mode} (${airport}) — ${e.code}, tentative ${attempt}/${MAX_ATTEMPTS}`);
      }
      await sleep(THROTTLE_MS * attempt);
    }
  }
}

function getHourInTZ(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    return h === 24 ? 0 : h;
  } catch {
    return new Date().getUTCHours();
  }
}

async function getFlightConfig() {
  const [rows] = await db.query(
    "SELECT config_key, config_value FROM theme_config WHERE config_key LIKE 'flight_%'"
  );
  const cfg = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
  return {
    airport_iata:     cfg.flight_airport_iata     || process.env.HOTEL_AIRPORT_IATA || 'OUA',
    refresh_interval: Math.min(1440, Math.max(1, parseInt(cfg.flight_refresh_interval || '5', 10))),
    auto_refresh:     cfg.flight_auto_refresh === '1',
    refresh_mode:     cfg.flight_refresh_mode     || 'interval',
    schedule_times:   (cfg.flight_schedule_times  || '').split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 23),
    timezone:         cfg.flight_timezone         || 'Africa/Ouagadougou',
  };
}

const STATUS_MAP = {
  'scheduled':    'scheduled',
  'active':       'active',
  'en route':     'active',
  'in flight':    'active',
  'airborne':     'active',
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

function normalizeStatus(text) {
  if (!text) return 'scheduled';
  return STATUS_MAP[text.toLowerCase().trim()] || 'scheduled';
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
    status:        normalizeStatus(fl.status?.text),
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

async function refreshFlights(airportOverride) {
  const FLIGHT_KEY = process.env.FLIGHTAPI_KEY;
  const config  = await getFlightConfig();
  const airport = (airportOverride || config.airport_iata).toUpperCase();

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
      // Stockage sans TTL : les données persistent même si le réseau tombe
      await cache.setPersist(key, JSON.stringify(payload));
      await addCredits(2);
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

// Tous les aéroports réellement desservis par les bornes, c'est-à-dire ceux rattachés à un
// hôtel (table hotel_airports). L'aéroport de theme_config ne sert que de repli : en
// multi-hôtel, s'en tenir à lui laisserait les autres aéroports figés indéfiniment.
async function getScheduledAirports() {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT airport_code FROM hotel_airports WHERE airport_code IS NOT NULL'
    );
    const codes = rows.map(r => r.airport_code.toUpperCase()).filter(Boolean);
    if (codes.length > 0) return codes;
  } catch (e) {
    console.warn(`[Flights] Lecture de hotel_airports impossible (${e.message}) — repli sur la config`);
  }
  const config = await getFlightConfig().catch(() => ({ airport_iata: 'OUA' }));
  return [config.airport_iata.toUpperCase()];
}

// Rafraîchit tous les aéroports desservis, en série (FlightAPI répond 401 si on l'inonde)
async function refreshAllAirports() {
  const airports = await getScheduledAirports();
  const results  = [];
  for (const code of airports) {
    try {
      results.push(await refreshFlights(code));
    } catch (e) {
      console.warn(`[Flights] Rafraîchissement de ${code} interrompu (${e.message})`);
      results.push({ airport: code, refreshed: 0, total: 2, errors: [e.message] });
    }
  }
  const ok = results.filter(r => r.refreshed > 0).length;
  console.log(`[Flights] Cycle terminé — ${ok}/${airports.length} aéroport(s) rafraîchi(s) : ${airports.join(', ')}`);
  return results;
}

function stopFlightScheduler() {
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

// Démarre (ou redémarre) le scheduler selon la config en base
async function startFlightScheduler() {
  stopFlightScheduler();

  let config;
  try {
    config = await getFlightConfig();
  } catch (_) {
    config = { auto_refresh: false, refresh_mode: 'interval', refresh_interval: 30, schedule_times: [], timezone: 'UTC' };
  }

  if (!config.auto_refresh) {
    console.log('[Flights] Scheduler désactivé (auto_refresh = false)');
    return;
  }

  if (config.refresh_mode === 'schedule') {
    if (config.schedule_times.length === 0) return;

    let lastFiredKey = null;
    schedulerTimer = setInterval(() => {
      const now = new Date();
      if (now.getMinutes() !== 0) return;
      const hour = getHourInTZ(config.timezone);
      if (!config.schedule_times.includes(hour)) return;
      const key = `${now.toDateString()}-${hour}`;
      if (key === lastFiredKey) return;
      lastFiredKey = key;
      console.log(`[Cron] Rafraîchissement vols programmé — ${hour}h (${config.timezone})`);
      refreshAllAirports().catch(() => {});
    }, 60_000);

    console.log(`[Flights] Scheduler admin programmé — ${config.schedule_times.map(h => h + 'h').join(', ')} (${config.timezone})`);
  } else {
    const intervalMs = config.refresh_interval * 60 * 1000;
    schedulerTimer = setInterval(() => {
      console.log(`[Cron] Rafraîchissement vols admin — ${new Date().toLocaleTimeString()}`);
      refreshAllAirports().catch(() => {});
    }, intervalMs);

    console.log(`[Flights] Scheduler admin actif — toutes les ${config.refresh_interval} min`);
  }
}

module.exports = {
  getFlightConfig,
  refreshFlights,
  refreshFlightsForAirport: refreshFlights,
  refreshAllAirports,
  getScheduledAirports,
  startFlightScheduler,
  stopFlightScheduler,
};
