// Service de conversion de devises
// Cascade de 3 APIs gratuites + fallback taux stockés en DB
const axios = require('axios');
const db    = require('./db');

let redisClient = null;
try {
  const { default: IORedis } = require('ioredis');
  redisClient = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    lazyConnect: true, enableOfflineQueue: false,
    connectTimeout: 2000, commandTimeout: 2000,
  });
  redisClient.on('error', () => { redisClient = null; });
} catch (_) { redisClient = null; }

const CACHE_TTL_SEC = 3600; // 1 heure

// ── Fournisseurs gratuits, en cascade ────────────────────────────
async function fetchFromOpenErApi(base) {
  const url = `https://open.er-api.com/v6/latest/${base.toUpperCase()}`;
  const r   = await axios.get(url, { timeout: 8000 });
  if (r.data?.result !== 'success') throw new Error('open.er-api: result != success');
  return r.data.rates; // { EUR: 0.0015, USD: 0.0016, ... }
}

async function fetchFromFawazCdn(base) {
  const b   = base.toLowerCase();
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${b}.json`;
  const r   = await axios.get(url, { timeout: 8000 });
  const map = r.data?.[b];
  if (!map) throw new Error('fawazahmed0: champ manquant');
  // clés en minuscules → normaliser en majuscules
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toUpperCase(), v]));
}

async function fetchFromExchangeRateApi(base, apiKey) {
  const key = apiKey || 'free'; // endpoint gratuit non authentifié
  const url  = apiKey
    ? `https://v6.exchangerate-api.com/v6/${key}/latest/${base.toUpperCase()}`
    : `https://api.exchangerate-api.com/v4/latest/${base.toUpperCase()}`;
  const r = await axios.get(url, { timeout: 8000 });
  return r.data?.rates || r.data?.conversion_rates;
}

// Essaie les 3 sources en cascade
async function fetchLiveRates(base, apiKey) {
  const providers = [
    () => fetchFromOpenErApi(base),
    () => fetchFromFawazCdn(base),
    () => fetchFromExchangeRateApi(base, apiKey),
  ];
  let lastErr;
  for (const fn of providers) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn('[Currency] Provider failed, trying next:', e.message);
    }
  }
  throw lastErr;
}

// ── Cache Redis ──────────────────────────────────────────────────
async function cacheGet(key) {
  if (!redisClient) return null;
  try { return JSON.parse(await redisClient.get(key)); } catch (_) { return null; }
}
async function cacheSet(key, value) {
  if (!redisClient) return;
  try { await redisClient.setex(key, CACHE_TTL_SEC, JSON.stringify(value)); } catch (_) {}
}

// ── Lecture config hôtel ─────────────────────────────────────────
async function getConfig(hotelId) {
  const [rows] = await db.query(
    'SELECT * FROM devise_config WHERE hotel_id = ?',
    [hotelId],
  );
  return rows[0] || null;
}

// ── Récupérer les taux ───────────────────────────────────────────
// Priorité : Redis partagé → DB hôtel → API live
// Le Redis partagé évite des appels API redondants quand un autre
// hôtel vient de fetcher la même devise, MAIS chaque hôtel conserve
// son propre intervalle et sa propre last_update.
async function getRates(hotelId) {
  const cfg = await getConfig(hotelId);
  if (!cfg) return null;

  const base           = cfg.base_currency;
  const sharedCacheKey = `currency:rates:shared:${base}`;

  // 1. Redis partagé (chaud = un autre hôtel a fetchée cette devise récemment)
  const cached = await cacheGet(sharedCacheKey);
  if (cached) return { rates: cached, base, from: 'cache', last_update: cfg.last_update };

  // 2. DB de CET hôtel — frais selon SON intervalle configuré
  if (cfg.rates && cfg.last_update) {
    const ageMs = Date.now() - new Date(cfg.last_update).getTime();
    const ttlMs = (cfg.update_interval_hours || 6) * 3600 * 1000;
    if (ageMs < ttlMs) {
      const rates = typeof cfg.rates === 'string' ? JSON.parse(cfg.rates) : cfg.rates;
      await cacheSet(sharedCacheKey, rates);
      return { rates, base, from: 'db', last_update: cfg.last_update };
    }
  }

  // 3. Fetch live
  return refreshRates(hotelId, cfg);
}

// ── Forcer la mise à jour des taux ───────────────────────────────
async function refreshRates(hotelId, cfg) {
  if (!cfg) cfg = await getConfig(hotelId);
  if (!cfg) throw new Error('Aucune configuration devise pour cet hôtel');

  const base           = cfg.base_currency;
  const sharedCacheKey = `currency:rates:shared:${base}`;

  // Si un autre hôtel vient de fetcher cette devise, réutiliser sans appel API
  const cachedRates = await cacheGet(sharedCacheKey);
  if (cachedRates) {
    await db.query(
      `UPDATE devise_config SET rates = ?, last_update = NOW() WHERE hotel_id = ?`,
      [JSON.stringify(cachedRates), hotelId],
    );
    return { rates: cachedRates, base, from: 'cache_refresh', last_update: new Date().toISOString() };
  }

  // Aucun cache → vrai appel API
  const rates = await fetchLiveRates(base, cfg.api_key);

  // Mise à jour uniquement de CET hôtel — chaque hôtel garde son propre last_update
  await db.query(
    `UPDATE devise_config SET rates = ?, last_update = NOW() WHERE hotel_id = ?`,
    [JSON.stringify(rates), hotelId],
  );

  // Cache partagé par devise — évite des appels API redondants pour les autres hôtels
  await cacheSet(sharedCacheKey, rates);

  return { rates, base, from: 'live', last_update: new Date().toISOString() };
}

// ── Convertir un montant ─────────────────────────────────────────
async function convert(hotelId, amount) {
  const result = await getRates(hotelId);
  if (!result) return null;

  const cfg     = await getConfig(hotelId);
  const targets = typeof cfg.target_currencies === 'string'
    ? JSON.parse(cfg.target_currencies)
    : cfg.target_currencies;

  const conversions = targets.map(code => ({
    code,
    amount: amount * (result.rates[code] ?? null),
  })).filter(c => c.amount !== null);

  return {
    base:         result.base,
    amount,
    conversions,
    last_update:  result.last_update,
    from:         result.from,
  };
}

// ── Scheduler auto-refresh ───────────────────────────────────────
async function startCurrencyScheduler() {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // vérifier toutes les 5 min

  async function tick() {
    try {
      const [hotels] = await db.query(
        `SELECT dc.hotel_id, dc.base_currency, dc.update_mode,
                dc.update_interval_hours, dc.daily_update_times,
                dc.last_update, dc.api_key
           FROM devise_config dc
          WHERE dc.update_mode = 'auto'`,
      );

      // Chaque hôtel est évalué indépendamment selon son propre intervalle.
      // Le cache Redis partagé par devise évite naturellement les appels API
      // redondants quand plusieurs hôtels ont la même devise de base.
      for (const cfg of hotels) {
        const now    = new Date();
        const lastUp = cfg.last_update ? new Date(cfg.last_update) : null;
        const ageH   = lastUp ? (now - lastUp) / 3_600_000 : Infinity;

        let shouldRefresh = false;

        if (cfg.daily_update_times) {
          const times = typeof cfg.daily_update_times === 'string'
            ? JSON.parse(cfg.daily_update_times)
            : cfg.daily_update_times;
          const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
          for (const t of times) {
            if (hhmm === t && ageH >= 0.9) { shouldRefresh = true; break; }
          }
        } else {
          shouldRefresh = ageH >= (cfg.update_interval_hours || 6);
        }

        if (shouldRefresh) {
          try {
            console.log(`[Currency] Refresh auto hôtel ${cfg.hotel_id} devise ${cfg.base_currency}`);
            await refreshRates(cfg.hotel_id, cfg);
          } catch (e) {
            console.error(`[Currency] Erreur refresh hôtel ${cfg.hotel_id}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error('[Currency Scheduler]', e.message);
    }
  }

  setInterval(tick, CHECK_INTERVAL_MS);
  tick(); // premier appel immédiat
}

module.exports = { getRates, refreshRates, convert, getConfig, startCurrencyScheduler };
