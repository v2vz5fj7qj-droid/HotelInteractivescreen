const express = require('express');
const cache   = require('../services/cacheService');
const db      = require('../services/db');
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

// GET /api/flights/search?flight=AH110[&hotel_id=X]
// Cherche dans le cache — tous les aéroports de l'hôtel si hotel_id fourni
router.get('/search', async (req, res) => {
  const flightNum = (req.query.flight || '').toUpperCase().trim().replace(/[\s-]/g, '');
  if (!flightNum) return res.status(400).json({ error: 'Numéro de vol requis' });

  const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id, 10) : null;
  const norm    = (s) => (s || '').toUpperCase().replace(/[\s-]/g, '');

  // Déterminer les aéroports à scruter
  let airportCodes = [DEF_AIRPORT];
  if (hotelId) {
    try {
      const [rows] = await db.query(
        'SELECT airport_code FROM hotel_airports WHERE hotel_id = ? ORDER BY display_order ASC',
        [hotelId]
      );
      if (rows.length > 0) airportCodes = rows.map(r => r.airport_code);
    } catch { /* garder DEF_AIRPORT si erreur DB */ }
  }

  const allFound = [];
  const seen     = new Set();

  for (const airport of airportCodes) {
    for (const type of ['arrivals', 'departures']) {
      const cached = await cache.get(`flights:${airport}:${type}`);
      if (!cached) continue;
      const { flights } = JSON.parse(cached);
      (flights || [])
        .filter(f => norm(f.flight_number).includes(norm(flightNum)))
        .forEach(f => {
          if (!seen.has(f.flight_number)) {
            seen.add(f.flight_number);
            allFound.push(f);
          }
        });
    }
  }

  return res.json({ flights: allFound });
});


module.exports = router;
