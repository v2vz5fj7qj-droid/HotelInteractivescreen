// ════════════════════════════════════════════════
//  ConnectBé — Flight Refresh Service
//  Utilisé par le scheduler automatique et l'endpoint admin
// ════════════════════════════════════════════════

const axios   = require('axios');
const cache   = require('./cacheService');
const db      = require('./db');
const { addCredits } = require('./creditTracker');

let schedulerTimer = null;

async function getFlightConfig() {
  const [rows] = await db.query(
    "SELECT config_key, config_value FROM theme_config WHERE config_key LIKE 'flight_%'"
  );
  const cfg = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
  return {
    airport_iata:     cfg.flight_airport_iata     || process.env.HOTEL_AIRPORT_IATA || 'OUA',
    refresh_interval: Math.max(1, parseInt(cfg.flight_refresh_interval || '5', 10)),
    auto_refresh:     cfg.flight_auto_refresh === '1',
  };
}

function normalizeFlightData(f) {
  const fl    = f?.flight || {};
  const toISO = (ts) => ts ? new Date(ts * 1000).toISOString() : null;
  return {
    flight_number: fl.identification?.number?.default || 'N/A',
    airline:       fl.airline?.name || 'Compagnie inconnue',
    status:        fl.status?.text  || 'scheduled',
    departure: {
      airport:   fl.airport?.origin?.name           || '',
      iata:      fl.airport?.origin?.code?.iata     || '',
      scheduled: toISO(fl.time?.scheduled?.departure),
      estimated: toISO(fl.time?.estimated?.departure),
      actual:    toISO(fl.time?.real?.departure),
      terminal:  fl.airport?.origin?.info?.terminal || null,
      gate:      fl.airport?.origin?.info?.gate     || null,
      delay:     0,
    },
    arrival: {
      airport:   fl.airport?.destination?.name           || '',
      iata:      fl.airport?.destination?.code?.iata     || '',
      scheduled: toISO(fl.time?.scheduled?.arrival),
      estimated: toISO(fl.time?.estimated?.arrival),
      actual:    toISO(fl.time?.real?.arrival),
      terminal:  fl.airport?.destination?.info?.terminal || null,
      gate:      fl.airport?.destination?.info?.gate     || null,
      delay:     0,
    },
  };
}

async function refreshFlights(airportOverride) {
  const FLIGHT_KEY = process.env.FLIGHTAPI_KEY;
  const config  = await getFlightConfig();
  const airport = (airportOverride || config.airport_iata).toUpperCase();

  if (!FLIGHT_KEY) {
    await cache.delPattern(`flights:${airport}:*`);
    return { refreshed: 0, airport, message: 'Clé API FlightAPI absente' };
  }

  let refreshed = 0;
  for (const type of ['arrivals', 'departures']) {
    try {
      const response = await axios.get(`https://api.flightapi.io/compschedule/${FLIGHT_KEY}`, {
        params: { mode: type, iata: airport, day: 0 },
        timeout: 10000,
      });
      const raw = response.data?.[0]?.airport?.pluginData?.schedule?.[type]?.data || [];
      const payload = {
        airport, type,
        flights: raw.map(normalizeFlightData),
        refreshed_at: Date.now(),
      };
      await cache.set(`flights:${airport}:${type}`, JSON.stringify(payload), config.refresh_interval * 60);
      await addCredits(2);
      refreshed++;
    } catch (e) {
      console.error('[Flight Refresh]', type, e.message);
    }
  }

  console.log(`[Flights] Rafraîchissement : ${refreshed}/2 (${airport})`);
  return { refreshed, total: 2, airport };
}

function stopFlightScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

// Démarre (ou redémarre) le scheduler selon la config en base
async function startFlightScheduler() {
  stopFlightScheduler();

  let config;
  try {
    config = await getFlightConfig();
  } catch (_) {
    config = { refresh_interval: 5, auto_refresh: false };
  }

  if (!config.auto_refresh) {
    console.log('[Flights] Rafraîchissement automatique désactivé');
    return;
  }

  const intervalMs = config.refresh_interval * 60 * 1000;
  schedulerTimer = setInterval(() => {
    console.log(`[Cron] Rafraîchissement vols — ${new Date().toLocaleTimeString()}`);
    refreshFlights().catch(e => console.error('[Cron Flights]', e.message));
  }, intervalMs);

  console.log(`[Flights] Scheduler actif — toutes les ${config.refresh_interval} min`);
}

module.exports = { getFlightConfig, refreshFlights, startFlightScheduler, stopFlightScheduler };
