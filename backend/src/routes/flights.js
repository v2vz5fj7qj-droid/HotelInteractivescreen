// Route publique kiosque — données de vols
// Sert uniquement le cache Redis alimenté par le scheduler (flightRefresh.js).
// Aucun appel API direct ici : si le cache est vide, retourne { _pending: true }.
// GET /api/flights?airport=OUA&type=arrivals|departures
// GET /api/flights/search?flight=AH110&hotel_id=X
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
// Cherche dans le cache — par numéro de vol OU nom de compagnie —
// tous les aéroports de l'hôtel si hotel_id fourni
router.get('/search', async (req, res) => {
  const rawQuery = (req.query.flight || '').trim();
  if (!rawQuery) return res.status(400).json({ error: 'Numéro de vol ou compagnie requis' });

  const hotelId   = req.query.hotel_id ? parseInt(req.query.hotel_id, 10) : null;
  const norm      = (s) => (s || '').toUpperCase().replace(/[\s-]/g, '');
  const normText  = (s) => (s || '').toUpperCase().trim();
  const flightNum = norm(rawQuery);
  const queryText = normText(rawQuery);

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
        .filter(f =>
          norm(f.flight_number).includes(flightNum) ||
          normText(f.airline).includes(queryText) ||
          norm(f.airline_icao).includes(flightNum)
        )
        .forEach(f => {
          // Un même numéro de vol peut avoir un segment arrivée ET un segment départ
          // (ex: escale) : dédupliquer sur vol+aéroports, pas juste le numéro de vol.
          const key = `${f.flight_number}|${f.departure?.iata}|${f.arrival?.iata}`;
          if (!seen.has(key)) {
            seen.add(key);
            allFound.push(f);
          }
        });
    }
  }

  // Une recherche par numéro contient toujours un chiffre (ex: AH110, ET932) ;
  // une recherche par compagnie est purement textuelle (ex: "Ethiopian").
  const isFlightNumberQuery = /\d/.test(rawQuery);

  if (isFlightNumberQuery) {
    allFound.sort((a, b) =>
      (a.flight_number || '').localeCompare(b.flight_number || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  } else {
    const timeKey = (f) => {
      const iso = f.departure?.scheduled || f.departure?.estimated || f.departure?.actual ||
                  f.arrival?.scheduled   || f.arrival?.estimated   || f.arrival?.actual;
      return iso ? new Date(iso).getTime() : Infinity;
    };
    allFound.sort((a, b) => timeKey(a) - timeKey(b));
  }

  return res.json({ flights: allFound });
});


module.exports = router;
