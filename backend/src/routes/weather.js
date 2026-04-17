const express = require('express');
const axios   = require('axios');
const cache   = require('../services/cacheService');
const db      = require('../services/db');
const router  = express.Router();

const OWM_KEY   = process.env.OPENWEATHERMAP_API_KEY;
const CACHE_TTL = 600; // 10 min

// Récupère la localité active (par défaut ou via ?locality_id=), filtrée par hôtel si fourni
async function getLocality(localityId, hotelId) {
  try {
    let rows;
    if (localityId && hotelId) {
      // Vérifier que la localité appartient bien à cet hôtel
      [rows] = await db.query(
        `SELECT l.* FROM localities l
           JOIN hotel_weather_localities hwl ON hwl.locality_id = l.id
          WHERE l.id = ? AND hwl.hotel_id = ? AND l.is_active = 1 LIMIT 1`,
        [localityId, hotelId]
      );
    } else if (localityId) {
      [rows] = await db.query(
        'SELECT * FROM localities WHERE id = ? AND is_active = 1 LIMIT 1',
        [localityId]
      );
    } else if (hotelId) {
      // Localité par défaut de l'hôtel
      [rows] = await db.query(
        `SELECT l.* FROM localities l
           JOIN hotel_weather_localities hwl ON hwl.locality_id = l.id
          WHERE hwl.hotel_id = ? AND hwl.is_default = 1 AND l.is_active = 1 LIMIT 1`,
        [hotelId]
      );
    } else {
      [rows] = await db.query(
        'SELECT * FROM localities WHERE is_default = 1 AND is_active = 1 LIMIT 1'
      );
    }
    if (rows?.length) return rows[0];
  } catch (_) {}
  // Fallback sur env var
  return {
    name: process.env.HOTEL_NAME || 'Ouagadougou',
    owm_city_id: process.env.HOTEL_CITY_OWM_ID || '2355426',
    lat: parseFloat(process.env.HOTEL_LAT) || 12.3641,
    lng: parseFloat(process.env.HOTEL_LNG) || -1.5332,
    timezone: 'Africa/Ouagadougou',
  };
}

// Agrège les intervalles 3h en journées (5 jours suivants, aujourd'hui exclu)
function aggregateDaily(list) {
  const today = new Date().toISOString().split('T')[0];
  const days = {};
  for (const entry of list) {
    const date = new Date(entry.dt * 1000).toISOString().split('T')[0];
    if (date === today) continue; // aujourd'hui déjà couvert par la météo courante
    if (!days[date]) {
      days[date] = { dt: entry.dt, temps: [], icons: {}, humidity: [], pop: 0, desc: '' };
    }
    days[date].temps.push(entry.main.temp);
    // Préférer les icônes de jour
    const icon = entry.weather[0].icon.replace('n', 'd');
    days[date].icons[icon] = (days[date].icons[icon] || 0) + 1;
    days[date].humidity.push(entry.main.humidity);
    days[date].pop = Math.max(days[date].pop, (entry.pop || 0) * 100);
    // Préférer la description de milieu de journée (12h–15h)
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

// Niveau UV
function uvLevel(uvi) {
  if (uvi < 3)  return { level: 'Faible',     color: '#10B981' };
  if (uvi < 6)  return { level: 'Modéré',     color: '#F59E0B' };
  if (uvi < 8)  return { level: 'Élevé',      color: '#F97316' };
  if (uvi < 11) return { level: 'Très élevé', color: '#EF4444' };
  return             { level: 'Extrême',    color: '#7C3AED' };
}

// Indicateur saisonnier pour Ouagadougou
function getSeasonInfo(month) {
  // Saison des pluies : juin–septembre (5–8)
  if (month >= 5 && month <= 8) return { key: 'rainy',     icon: '🌧️' };
  // Harmattan : novembre–février (10–1)
  if (month >= 10 || month <= 1) return { key: 'harmattan', icon: '🌫️' };
  return                                { key: 'dry',        icon: '☀️' };
}

// Retourne les dernières vraies données (stale) ou null
async function getStaleWeather(cacheKey) {
  const raw = await cache.get(`${cacheKey}:stale`);
  if (!raw) return null;
  const payload = JSON.parse(raw);
  payload._stale = true;
  return payload;
}

// GET /api/weather/current?locality_id=&hotel_id=
router.get('/current', async (req, res) => {
  const hotelId  = req.query.hotel_id ? parseInt(req.query.hotel_id, 10) : null;
  const locality = await getLocality(req.query.locality_id, hotelId);
  const cacheKey   = `weather:current:${locality.owm_city_id || locality.id}`;
  const cached     = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  if (!OWM_KEY) {
    const stale = await getStaleWeather(cacheKey);
    if (stale) return res.json(stale);
    return res.status(503).json({ error: 'Clé API météo non configurée', _unavailable: true });
  }

  try {
    const params = { lat: locality.lat, lon: locality.lng, appid: OWM_KEY, units: 'metric', lang: 'fr' };

    const [curr, forecast3h, uvRes] = await Promise.allSettled([
      axios.get('https://api.openweathermap.org/data/2.5/weather',   { params }),
      axios.get('https://api.openweathermap.org/data/2.5/forecast',  { params }),
      axios.get('https://api.openweathermap.org/data/2.5/uvi',       {
        params: { lat: locality.lat, lon: locality.lng, appid: OWM_KEY },
      }),
    ]);

    const c  = curr.value?.data;
    const f  = forecast3h.value?.data?.list || [];
    const uvi = uvRes.value?.data?.value ?? null;
    const month = new Date().getMonth(); // 0-indexed

    if (!c?.main) {
      const status = curr.value?.status ?? curr.reason?.response?.status;
      const msg    = curr.reason?.response?.data?.message ?? curr.reason?.message ?? 'réponse vide';
      throw new Error(`Réponse OWM invalide (HTTP ${status}) — ${msg}`);
    }

    // Calcul min/max du jour à partir des prévisions 3h (plus fiable que c.main.temp_min/max)
    const todayStr   = new Date().toISOString().split('T')[0];
    const todayTemps = f
      .filter(e => new Date(e.dt * 1000).toISOString().split('T')[0] === todayStr)
      .map(e => e.main.temp);
    const todayMin = todayTemps.length > 0 ? Math.round(Math.min(...todayTemps)) : Math.round(c.main.temp_min);
    const todayMax = todayTemps.length > 0 ? Math.round(Math.max(...todayTemps)) : Math.round(c.main.temp_max);

    const payload = {
      locality: { name: locality.name, country: locality.country },
      current: {
        temp:        Math.round(c.main.temp),
        feels_like:  Math.round(c.main.feels_like),
        temp_min:    todayMin,
        temp_max:    todayMax,
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
        dt:    e.dt,
        temp:  Math.round(e.main.temp),
        icon:  e.weather[0].icon,
        pop:   Math.round((e.pop || 0) * 100),
      })),
      alerts: [],
    };

    await cache.set(cacheKey, JSON.stringify(payload), CACHE_TTL);
    // Sauvegarde persistante (30 jours) pour le fallback stale
    await cache.set(`${cacheKey}:stale`, JSON.stringify(payload), 30 * 24 * 3600);
    res.json(payload);
  } catch (err) {
    console.error('[Weather]', err.message);
    const stale = await getStaleWeather(cacheKey);
    if (stale) return res.json(stale);
    res.status(503).json({ error: 'Données météo indisponibles', _unavailable: true });
  }
});

// GET /api/weather/localities — liste des localités actives filtrée par hôtel
router.get('/localities', async (req, res) => {
  const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id, 10) : null;
  try {
    let rows;
    if (hotelId) {
      // Retourner uniquement les localités affectées à cet hôtel
      [rows] = await db.query(
        `SELECT l.id, l.name, l.country, hwl.is_default
           FROM localities l
           JOIN hotel_weather_localities hwl ON hwl.locality_id = l.id
          WHERE hwl.hotel_id = ? AND l.is_active = 1
          ORDER BY hwl.display_order, l.name`,
        [hotelId]
      );
    } else {
      // Fallback sans hôtel : toutes les localités actives
      [rows] = await db.query(
        'SELECT id, name, country, is_default FROM localities WHERE is_active = 1 ORDER BY display_order, name'
      );
    }
    res.json(rows);
  } catch { res.json([]); }
});


module.exports = router;
