const express = require('express');
const axios   = require('axios');
const cache   = require('../services/cacheService');
const db      = require('../services/db');
const router  = express.Router();

const OWM_KEY   = process.env.OPENWEATHERMAP_API_KEY;
const CACHE_TTL = 600; // 10 min

// Récupère la localité active (par défaut ou via ?locality_id=)
async function getLocality(localityId) {
  try {
    const query = localityId
      ? 'SELECT * FROM localities WHERE id = ? AND is_active = 1 LIMIT 1'
      : 'SELECT * FROM localities WHERE is_default = 1 AND is_active = 1 LIMIT 1';
    const params = localityId ? [localityId] : [];
    const [rows] = await db.query(query, params);
    if (rows.length) return rows[0];
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

// Agrège les intervalles 3h en journées
function aggregateDaily(list) {
  const days = {};
  for (const entry of list) {
    const date = new Date(entry.dt * 1000).toISOString().split('T')[0];
    if (!days[date]) {
      days[date] = { dt: entry.dt, temps: [], icons: {}, humidity: [], pop: 0, desc: '' };
    }
    days[date].temps.push(entry.main.temp);
    // Préférer les icônes de jour
    const icon = entry.weather[0].icon.replace('n', 'd');
    days[date].icons[icon] = (days[date].icons[icon] || 0) + 1;
    days[date].humidity.push(entry.main.humidity);
    days[date].pop = Math.max(days[date].pop, (entry.pop || 0) * 100);
    if (!days[date].desc) days[date].desc = entry.weather[0].description;
  }
  return Object.values(days).slice(0, 7).map(d => ({
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

// GET /api/weather/current?locality_id=
router.get('/current', async (req, res) => {
  const locality   = await getLocality(req.query.locality_id);
  const cacheKey   = `weather:current:${locality.owm_city_id || locality.id}`;
  const cached     = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  if (!OWM_KEY) return res.json(getMockWeather(locality));

  try {
    const params = locality.owm_city_id
      ? { id: locality.owm_city_id, appid: OWM_KEY, units: 'metric', lang: 'fr' }
      : { lat: locality.lat, lon: locality.lng, appid: OWM_KEY, units: 'metric', lang: 'fr' };

    const [curr, forecast3h, uvRes] = await Promise.allSettled([
      axios.get('https://api.openweathermap.org/data/2.5/weather',   { params }),
      axios.get('https://api.openweathermap.org/data/2.5/forecast',  { params }),
      axios.get('https://api.openweathermap.org/data/2.5/uvi',       {
        params: { lat: locality.lat || curr?.value?.data?.coord?.lat,
                  lon: locality.lng || curr?.value?.data?.coord?.lon,
                  appid: OWM_KEY },
      }),
    ]);

    const c  = curr.value?.data;
    const f  = forecast3h.value?.data?.list || [];
    const uvi = uvRes.value?.data?.value ?? null;
    const month = new Date().getMonth(); // 0-indexed

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
        dt:    e.dt,
        temp:  Math.round(e.main.temp),
        icon:  e.weather[0].icon,
        pop:   Math.round((e.pop || 0) * 100),
      })),
      alerts: [],
    };

    await cache.set(cacheKey, JSON.stringify(payload), CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[Weather]', err.message);
    res.json(getMockWeather(locality));
  }
});

// GET /api/weather/localities — liste publique des localités actives
router.get('/localities', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, country, is_default FROM localities WHERE is_active = 1 ORDER BY display_order, name'
    );
    res.json(rows);
  } catch { res.json([]); }
});

function getMockWeather(locality = {}) {
  const now   = Math.floor(Date.now() / 1000);
  const month = new Date().getMonth();
  return {
    _mock: true,
    locality: { name: locality.name || 'Ouagadougou', country: locality.country || 'Burkina Faso' },
    current: {
      temp: 34, feels_like: 39, temp_min: 28, temp_max: 38,
      humidity: 35, pressure: 1008,
      wind_speed: 22, wind_deg: 45,
      visibility: 8,
      icon: '01d', description: 'Ciel dégagé',
      sunrise: now - 3600 * 5, sunset: now + 3600 * 7,
      uvi: 11, uvi_info: { level: 'Extrême', color: '#7C3AED' },
      season: getSeasonInfo(month),
      dt: now,
    },
    forecast: Array.from({ length: 5 }, (_, i) => ({
      dt: now + i * 86400,
      temp_max: 35 + Math.round(Math.random() * 4),
      temp_min: 22 + Math.round(Math.random() * 3),
      icon: ['01d','02d','10d','01d','02d'][i],
      description: ['Ensoleillé','Partiellement nuageux','Averses','Ensoleillé','Nuageux'][i],
      pop: [0, 10, 60, 5, 20][i],
      humidity: 35 + Math.round(Math.random() * 20),
    })),
    hourly: Array.from({ length: 8 }, (_, i) => ({
      dt:   now + i * 10800,
      temp: 30 + Math.round(Math.random() * 8),
      icon: i < 3 ? '01d' : '02d',
      pop:  i === 5 ? 40 : 0,
    })),
    alerts: [],
  };
}

module.exports = router;
