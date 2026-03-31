// ════════════════════════════════════════════════
//  ConnectBé — Flight Refresh Service
//  Utilisé par le scheduler automatique et l'endpoint admin
// ════════════════════════════════════════════════

const axios   = require('axios');
const cache   = require('./cacheService');
const db      = require('./db');
const { addCredits } = require('./creditTracker');

const AUTO_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — fixe, toujours actif

let schedulerTimer     = null;
let autoSchedulerTimer = null; // scheduler 30 min permanent

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

function normalizeFlightData(f) {
  const fl    = f?.flight || {};
  const toISO = (ts) => ts ? new Date(ts * 1000).toISOString() : null;
  return {
    flight_number: fl.identification?.number?.default || 'N/A',
    airline:       fl.airline?.name || 'Compagnie inconnue',
    status:        normalizeStatus(fl.status?.text),
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
        timeout: 15000,
      });
      const raw = response.data?.[0]?.airport?.pluginData?.schedule?.[type]?.data || [];
      const payload = {
        airport, type,
        flights:      raw.map(normalizeFlightData),
        refreshed_at: Date.now(),
        stale:        false,
      };
      // Stockage sans TTL : les données persistent même si le réseau tombe
      await cache.setPersist(`flights:${airport}:${type}`, JSON.stringify(payload));
      await addCredits(2);
      refreshed++;
    } catch (e) {
      // Réseau indisponible ou erreur API — on conserve les anciennes données sans toucher au cache
      console.warn(`[Flight Refresh] ${type} échoué (${e.message}) — anciennes données conservées`);
    }
  }

  console.log(`[Flights] Rafraîchissement : ${refreshed}/2 (${airport})`);
  return { refreshed, total: 2, airport };
}

function stopFlightScheduler() {
  if (schedulerTimer)     { clearInterval(schedulerTimer);     schedulerTimer     = null; }
  if (autoSchedulerTimer) { clearInterval(autoSchedulerTimer); autoSchedulerTimer = null; }
}

// Démarre (ou redémarre) le scheduler selon la config en base
async function startFlightScheduler() {
  stopFlightScheduler();

  // ── Scheduler 30 min — toujours actif, indépendant des réglages admin ──
  autoSchedulerTimer = setInterval(() => {
    console.log(`[Flights] Rafraîchissement automatique 30 min — ${new Date().toLocaleTimeString()}`);
    refreshFlights().catch(() => {}); // erreur réseau silencieuse — cache conservé
  }, AUTO_REFRESH_INTERVAL_MS);

  console.log('[Flights] Scheduler permanent 30 min démarré');

  // ── Scheduler admin (optionnel, en complément) ──
  let config;
  try {
    config = await getFlightConfig();
  } catch (_) {
    config = { auto_refresh: false, refresh_mode: 'interval', refresh_interval: 30, schedule_times: [], timezone: 'UTC' };
  }

  if (!config.auto_refresh) return;

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
      refreshFlights().catch(() => {});
    }, 60_000);

    console.log(`[Flights] Scheduler admin programmé — ${config.schedule_times.map(h => h + 'h').join(', ')} (${config.timezone})`);
  } else {
    const intervalMs = config.refresh_interval * 60 * 1000;
    schedulerTimer = setInterval(() => {
      console.log(`[Cron] Rafraîchissement vols admin — ${new Date().toLocaleTimeString()}`);
      refreshFlights().catch(() => {});
    }, intervalMs);

    console.log(`[Flights] Scheduler admin actif — toutes les ${config.refresh_interval} min`);
  }
}

module.exports = { getFlightConfig, refreshFlights, startFlightScheduler, stopFlightScheduler };
