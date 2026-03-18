const express = require('express');
const axios   = require('axios');
const cache   = require('../services/cacheService');
const router  = express.Router();

const OWM_KEY  = process.env.OPENWEATHERMAP_API_KEY;
const CITY_ID  = process.env.HOTEL_CITY_OWM_ID || '2355426';
const CACHE_TTL = 600; // 10 min

// GET /api/weather/current
router.get('/current', async (req, res) => {
  const cacheKey = `weather:current:${CITY_ID}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  if (!OWM_KEY) {
    return res.json(getMockWeather());
  }

  try {
    const [curr, forecast] = await Promise.all([
      axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { id: CITY_ID, appid: OWM_KEY, units: 'metric', lang: 'fr' },
      }),
      axios.get('https://api.openweathermap.org/data/2.5/forecast/daily', {
        params: { id: CITY_ID, appid: OWM_KEY, units: 'metric', cnt: 7, lang: 'fr' },
      }),
    ]);

    const payload = {
      current: {
        temp:        curr.data.main.temp,
        feels_like:  curr.data.main.feels_like,
        humidity:    curr.data.main.humidity,
        pressure:    curr.data.main.pressure,
        wind_speed:  Math.round((curr.data.wind.speed || 0) * 3.6),
        visibility:  Math.round((curr.data.visibility || 10000) / 1000),
        icon:        curr.data.weather[0].icon,
        description: curr.data.weather[0].description,
      },
      forecast: forecast.data.list.map(d => ({
        dt:          d.dt,
        temp_max:    d.temp.max,
        temp_min:    d.temp.min,
        icon:        d.weather[0].icon,
        description: d.weather[0].description,
        pop:         Math.round((d.pop || 0) * 100),
        humidity:    d.humidity,
      })),
      alerts: [],
    };

    await cache.set(cacheKey, JSON.stringify(payload), CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[Weather]', err.message);
    // Fallback données mock si API indisponible (mode offline)
    res.json(getMockWeather());
  }
});

// Données de fallback pour le mode offline / dev sans clé API
function getMockWeather() {
  const now = Math.floor(Date.now() / 1000);
  return {
    _mock: true,
    current: {
      temp: 34, feels_like: 38, humidity: 45, pressure: 1008,
      wind_speed: 18, visibility: 10,
      icon: '01d', description: 'Ciel dégagé',
    },
    forecast: Array.from({ length: 7 }, (_, i) => ({
      dt: now + i * 86400,
      temp_max: 35 + Math.round(Math.random() * 4),
      temp_min: 22 + Math.round(Math.random() * 3),
      icon: ['01d','02d','10d','01d','02d','01d','03d'][i],
      description: ['Ensoleillé','Partiellement nuageux','Averses','Ensoleillé','Nuageux','Ensoleillé','Nuageux'][i],
      pop: [0, 10, 60, 5, 20, 0, 15][i],
      humidity: 40 + Math.round(Math.random() * 20),
    })),
    alerts: [],
  };
}

module.exports = router;
