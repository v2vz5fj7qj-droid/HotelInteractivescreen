const express = require('express');
const axios   = require('axios');
const cache   = require('../services/cacheService');
const router  = express.Router();

const FLIGHT_KEY   = process.env.AVIATIONSTACK_API_KEY;
const DEF_AIRPORT  = process.env.HOTEL_AIRPORT_IATA || 'OUA';
const CACHE_TTL    = 120; // 2 min (données vols plus volatiles)

// GET /api/flights?airport=OUA&type=arrivals|departures
router.get('/', async (req, res) => {
  const airport = (req.query.airport || DEF_AIRPORT).toUpperCase();
  const type    = req.query.type === 'departures' ? 'departures' : 'arrivals';

  const cacheKey = `flights:${airport}:${type}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  if (!FLIGHT_KEY) {
    return res.json(getMockFlights(airport, type));
  }

  try {
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: {
        access_key: FLIGHT_KEY,
        [type === 'arrivals' ? 'arr_iata' : 'dep_iata']: airport,
        limit: 20,
      },
      timeout: 8000,
    });

    const payload = {
      airport,
      type,
      flights: (response.data.data || []).map(normalizeFlightData),
    };

    await cache.set(cacheKey, JSON.stringify(payload), CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[Flights]', err.message);
    res.json(getMockFlights(airport, type));
  }
});

// GET /api/flights/search?flight=AH110
router.get('/search', async (req, res) => {
  const flightNum = (req.query.flight || '').toUpperCase().trim();
  if (!flightNum) return res.status(400).json({ error: 'Numéro de vol requis' });

  if (!FLIGHT_KEY) return res.json({ flights: [getMockSingleFlight(flightNum)] });

  try {
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
      params: { access_key: FLIGHT_KEY, flight_iata: flightNum },
      timeout: 8000,
    });
    res.json({ flights: (response.data.data || []).map(normalizeFlightData) });
  } catch (err) {
    console.error('[Flights search]', err.message);
    res.json({ flights: [getMockSingleFlight(flightNum)] });
  }
});

function normalizeFlightData(f) {
  return {
    flight_number: f.flight?.iata || 'N/A',
    airline:       f.airline?.name || 'Compagnie inconnue',
    status:        f.flight_status || 'scheduled',
    // Arrivée
    arrival: {
      airport:   f.arrival?.airport || '',
      iata:      f.arrival?.iata    || '',
      scheduled: f.arrival?.scheduled,
      estimated: f.arrival?.estimated,
      actual:    f.arrival?.actual,
      terminal:  f.arrival?.terminal || null,
      gate:      f.arrival?.gate     || null,
      delay:     f.arrival?.delay    || 0,
    },
    // Départ
    departure: {
      airport:   f.departure?.airport    || '',
      iata:      f.departure?.iata       || '',
      scheduled: f.departure?.scheduled,
      estimated: f.departure?.estimated,
      actual:    f.departure?.actual,
      terminal:  f.departure?.terminal   || null,
      gate:      f.departure?.gate       || null,
      delay:     f.departure?.delay      || 0,
    },
  };
}

function getMockFlights(airport, type) {
  const now = new Date();
  const soon = (h) => new Date(now.getTime() + h * 3600000).toISOString();

  return {
    _mock: true,
    airport,
    type,
    flights: [
      {
        flight_number: 'AH 110',
        airline: 'Air Algérie',
        status: 'scheduled',
        departure: { airport: 'Alger Houari Boumediene', iata: 'ALG', scheduled: soon(2), delay: 0, gate: 'B3' },
        arrival:   { airport: 'Ouagadougou', iata: 'OUA', scheduled: soon(5), delay: 0, gate: 'A1' },
      },
      {
        flight_number: 'ET 811',
        airline: 'Ethiopian Airlines',
        status: 'active',
        departure: { airport: 'Addis Abeba', iata: 'ADD', scheduled: soon(-1), delay: 15, gate: 'C2' },
        arrival:   { airport: 'Ouagadougou', iata: 'OUA', scheduled: soon(2), delay: 15, gate: 'A2' },
      },
      {
        flight_number: 'AT 530',
        airline: 'Royal Air Maroc',
        status: 'landed',
        departure: { airport: 'Casablanca', iata: 'CMN', scheduled: soon(-6), delay: 0, gate: 'D1' },
        arrival:   { airport: 'Ouagadougou', iata: 'OUA', scheduled: soon(-1), delay: 0, gate: 'A1' },
      },
    ],
  };
}

function getMockSingleFlight(flightNum) {
  return {
    flight_number: flightNum,
    airline: 'Compagnie exemple',
    status: 'scheduled',
    departure: { airport: 'Paris Charles de Gaulle', iata: 'CDG', scheduled: new Date().toISOString(), delay: 0, gate: 'F23' },
    arrival:   { airport: 'Ouagadougou', iata: 'OUA', scheduled: new Date(Date.now() + 5 * 3600000).toISOString(), delay: 0, gate: 'A1' },
  };
}

module.exports = router;
