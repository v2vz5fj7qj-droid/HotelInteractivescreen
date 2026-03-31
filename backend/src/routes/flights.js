const express = require('express');
const cache   = require('../services/cacheService');
const router  = express.Router();

const DEF_AIRPORT = process.env.HOTEL_AIRPORT_IATA || 'OUA';

// GET /api/flights?airport=OUA&type=arrivals|departures
// Sert uniquement les données en cache (alimentées par le scheduler admin)
router.get('/', async (req, res) => {
  const airport = (req.query.airport || DEF_AIRPORT).toUpperCase();
  const type    = req.query.type === 'departures' ? 'departures' : 'arrivals';

  const cached = await cache.get(`flights:${airport}:${type}`);
  if (cached) return res.json(JSON.parse(cached));

  res.json({ _pending: true, flights: [], airport, type });
});

// GET /api/flights/search?flight=AH110
// Cherche uniquement dans le cache existant
router.get('/search', async (req, res) => {
  const flightNum = (req.query.flight || '').toUpperCase().trim().replace(/[\s-]/g, '');
  if (!flightNum) return res.status(400).json({ error: 'Numéro de vol requis' });

  const airport = DEF_AIRPORT;
  const norm    = (s) => (s || '').toUpperCase().replace(/[\s-]/g, '');

  for (const type of ['arrivals', 'departures']) {
    const cached = await cache.get(`flights:${airport}:${type}`);
    if (!cached) continue;
    const { flights } = JSON.parse(cached);
    const found = (flights || []).filter(f => norm(f.flight_number).includes(norm(flightNum)));
    if (found.length > 0) return res.json({ flights: found });
  }

  return res.json({ flights: [] });
});


module.exports = router;
