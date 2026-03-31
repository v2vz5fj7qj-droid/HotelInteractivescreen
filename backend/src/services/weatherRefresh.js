// ════════════════════════════════════════════════
//  ConnectBé — Weather Refresh Service
//  Utilisé par le scheduler automatique et l'endpoint admin
// ════════════════════════════════════════════════

const axios = require('axios');
const cache = require('./cacheService');
const db    = require('./db');

const OWM_KEY   = process.env.OPENWEATHERMAP_API_KEY;
const CACHE_TTL = 600; // 10 min

// Heures de rafraîchissement automatique (heure locale serveur)
const REFRESH_HOURS = [0, 8, 16, 20];

function aggregateDaily(list) {
  const today = new Date().toISOString().split('T')[0];
  const days = {};
  for (const entry of list) {
    const date = new Date(entry.dt * 1000).toISOString().split('T')[0];
    if (date === today) continue;
    if (!days[date]) {
      days[date] = { dt: entry.dt, temps: [], icons: {}, humidity: [], pop: 0, desc: '' };
    }
    days[date].temps.push(entry.main.temp);
    const icon = entry.weather[0].icon.replace('n', 'd');
    days[date].icons[icon] = (days[date].icons[icon] || 0) + 1;
    days[date].humidity.push(entry.main.humidity);
    days[date].pop = Math.max(days[date].pop, (entry.pop || 0) * 100);
    const hour = new Date(entry.dt * 1000).getUTCHours();
    if (!days[date].desc || (hour >= 12 && hour <= 15)) days[date].desc = entry.weather[0].description;
  }
  return Object.values(days).slice(0, 5).map(d => ({
    dt:          d.dt,
    temp_max:    Math.round(Math.max(...d.temps)),
    temp_min:    Math.round(Math.min(...d.temps)),
    icon:        Object.entries(d.icons).sort((a, b) => b[1] - a[1])[0][0],
    description: d.desc,
    pop:         Math.round(d.pop),
    humidity:    Math.round(d.humidity.reduce((a, b) => a + b, 0) / d.humidity.length),
  }));
}

function uvLevel(uvi) {
  if (uvi < 3)  return { level: 'Faible',     color: '#10B981' };
  if (uvi < 6)  return { level: 'Modéré',     color: '#F59E0B' };
  if (uvi < 8)  return { level: 'Élevé',      color: '#F97316' };
  if (uvi < 11) return { level: 'Très élevé', color: '#EF4444' };
  return             { level: 'Extrême',    color: '#7C3AED' };
}

function getSeasonInfo(month) {
  if (month >= 5 && month <= 8) return { key: 'rainy',     icon: '🌧️' };
  if (month >= 10 || month <= 1) return { key: 'harmattan', icon: '🌫️' };
  return                                { key: 'dry',        icon: '☀️' };
}

async function fetchAndCacheLocality(locality) {
  if (!OWM_KEY) return false;
  const cacheKey = `weather:current:${locality.owm_city_id || locality.id}`;
  const params = locality.owm_city_id
    ? { id: locality.owm_city_id, appid: OWM_KEY, units: 'metric', lang: 'fr' }
    : { lat: locality.lat, lon: locality.lng, appid: OWM_KEY, units: 'metric', lang: 'fr' };

  const [curr, forecast3h, uvRes] = await Promise.allSettled([
    axios.get('https://api.openweathermap.org/data/2.5/weather',  { params }),
    axios.get('https://api.openweathermap.org/data/2.5/forecast', { params }),
    axios.get('https://api.openweathermap.org/data/2.5/uvi', {
      params: { lat: locality.lat, lon: locality.lng, appid: OWM_KEY },
    }),
  ]);

  const c   = curr.value?.data;
  const f   = forecast3h.value?.data?.list || [];
  const uvi = uvRes.value?.data?.value ?? null;

  if (!c?.main) return false;

  const month = new Date().getMonth();
  const payload = {
    locality: { name: locality.name, country: locality.country },
    current: {
      temp:        Math.round(c.main.temp),
      feels_like:  Math.round(c.main.feels_like),
      temp_min:    Math.round(c.main.temp_min),
      temp_max:    Math.round(c.main.temp_max),
      humidity:    c.main.humidity,
      pressure:    c.main.pressure,
      wind_speed:  Math.round((c.wind.speed || 0) * 3.6),
      wind_deg:    c.wind.deg || 0,
      visibility:  Math.round((c.visibility || 10000) / 1000),
      icon:        c.weather[0].icon,
      description: c.weather[0].description,
      sunrise:     c.sys.sunrise,
      sunset:      c.sys.sunset,
      uvi:         uvi !== null ? Math.round(uvi) : null,
      uvi_info:    uvi !== null ? uvLevel(uvi) : null,
      season:      getSeasonInfo(month),
      dt:          c.dt,
    },
    forecast: aggregateDaily(f),
    hourly: f.slice(0, 8).map(e => ({
      dt:   e.dt,
      temp: Math.round(e.main.temp),
      icon: e.weather[0].icon,
      pop:  Math.round((e.pop || 0) * 100),
    })),
    alerts: [],
  };

  await cache.set(cacheKey, JSON.stringify(payload), CACHE_TTL);
  // Sauvegarde persistante (30 jours) pour le fallback stale
  await cache.set(`${cacheKey}:stale`, JSON.stringify(payload), 30 * 24 * 3600);
  return true;
}

// Vide le cache météo et re-précharge toutes les localités actives
async function refreshAllLocalities() {
  await cache.delPattern('weather:*');
  if (!OWM_KEY) return { refreshed: 0, total: 0, message: 'Clé API OWM absente' };

  let rows = [];
  try {
    [rows] = await db.query('SELECT * FROM localities WHERE is_active = 1 ORDER BY is_default DESC');
  } catch (_) {}

  let refreshed = 0;
  for (const loc of rows) {
    try {
      const ok = await fetchAndCacheLocality(loc);
      if (ok) refreshed++;
    } catch (e) {
      console.error('[Weather Refresh]', loc.name, e.message);
    }
  }
  console.log(`[Weather] Rafraîchissement : ${refreshed}/${rows.length} localité(s)`);
  return { refreshed, total: rows.length };
}

// Démarre le scheduler (à appeler une seule fois depuis app.js)
function startWeatherScheduler() {
  let lastKey = null;

  setInterval(() => {
    const now = new Date();
    if (now.getMinutes() !== 0) return;
    if (!REFRESH_HOURS.includes(now.getHours())) return;

    const key = `${now.toDateString()}-${now.getHours()}`;
    if (key === lastKey) return; // déjà déclenché cette heure-ci
    lastKey = key;

    console.log(`[Cron] Rafraîchissement météo automatique — ${now.toLocaleTimeString()}`);
    refreshAllLocalities().catch(e => console.error('[Cron]', e.message));
  }, 60_000); // vérifie chaque minute

  console.log(`[Weather] Scheduler actif — rafraîchissements à ${REFRESH_HOURS.map(h => h + 'h').join(', ')}`);
}

module.exports = { refreshAllLocalities, startWeatherScheduler };
