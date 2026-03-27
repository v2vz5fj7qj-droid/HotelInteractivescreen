const express = require('express');
const axios   = require('axios');
const cache   = require('../services/cacheService');
const { addCredits } = require('../services/creditTracker');
const router  = express.Router();

const DEF_AIRPORT = process.env.HOTEL_AIRPORT_IATA || 'OUA';
const CACHE_TTL   = 120; // 2 min (données vols plus volatiles)

// GET /api/flights?airport=OUA&type=arrivals|departures
router.get('/', async (req, res) => {
  const FLIGHT_KEY = process.env.FLIGHTAPI_KEY;
  const airport = (req.query.airport || DEF_AIRPORT).toUpperCase();
  const type    = req.query.type === 'departures' ? 'departures' : 'arrivals';

  const cacheKey = `flights:${airport}:${type}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  if (!FLIGHT_KEY) {
    return res.json(getMockFlights(airport, type));
  }

  try {
    const response = await axios.get(`https://api.flightapi.io/compschedule/${FLIGHT_KEY}`, {
      params: { mode: type, iata: airport, day: 0 },
      timeout: 10000,
    });

    // Réponse : tableau, airport en [0], vols sous .pluginData.schedule[type].data
    const raw = response.data?.[0]?.airport?.pluginData?.schedule?.[type]?.data || [];

    const payload = {
      airport,
      type,
      flights: raw.map(normalizeFlightData),
    };

    await cache.set(cacheKey, JSON.stringify(payload), CACHE_TTL);
    addCredits(2).catch(() => {}); // 2 crédits par appel schedule
    res.json(payload);
  } catch (err) {
    console.error('[Flights]', err.message);
    res.json(getMockFlights(airport, type));
  }
});

// GET /api/flights/search?flight=AH110
router.get('/search', async (req, res) => {
  const FLIGHT_KEY = process.env.FLIGHTAPI_KEY;
  const flightNum = (req.query.flight || '').toUpperCase().trim();
  if (!flightNum) return res.status(400).json({ error: 'Numéro de vol requis' });

  if (!FLIGHT_KEY) return res.json({ flights: [getMockSingleFlight(flightNum)] });

  // Découpage du numéro de vol : "AH110" → name="AH", num="110"
  const match = flightNum.match(/^([A-Z]{2})(\d+)$/);
  if (!match) return res.status(400).json({ error: 'Format invalide (ex: AH110)' });

  const [, airlineCode, num] = match;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  try {
    const response = await axios.get('https://api.flightapi.io/airline', {
      params: { api_key: FLIGHT_KEY, num, name: airlineCode, date },
      timeout: 8000,
    });
    addCredits(2).catch(() => {}); // 2 crédits par appel airline
    res.json({ flights: (response.data || []).map(normalizeTrackingData) });
  } catch (err) {
    console.error('[Flights search]', err.message);
    res.json({ flights: [getMockSingleFlight(flightNum)] });
  }
});

// Normalisation réponse Schedule API (/schedule)
// Timestamps Unix → ISO, structure imbriquée FlightAPI
function normalizeFlightData(f) {
  const fl    = f?.flight || {};
  const toISO = (ts) => ts ? new Date(ts * 1000).toISOString() : null;

  return {
    flight_number: fl.identification?.number?.default || 'N/A',
    airline:       fl.airline?.name || 'Compagnie inconnue',
    status:        fl.status?.text  || 'scheduled',
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

// Normalisation réponse Tracking API (/airline)
function normalizeTrackingData(f) {
  return {
    flight_number: (f.airline?.iata || '') + (f.flight?.number || ''),
    airline:       f.airline?.name  || 'Compagnie inconnue',
    status:        f.status         || 'scheduled',
    departure: {
      airport:   f.departure?.airport       || '',
      iata:      f.departure?.airportCode   || '',
      scheduled: f.departure?.scheduledTime || null,
      estimated: f.departure?.estimatedTime || null,
      actual:    f.departure?.outGateTime   || null,
      terminal:  f.departure?.terminal      || null,
      gate:      f.departure?.gate          || null,
      delay:     0,
    },
    arrival: {
      airport:   f.arrival?.airport       || '',
      iata:      f.arrival?.airportCode   || '',
      scheduled: f.arrival?.scheduledTime || null,
      estimated: f.arrival?.estimatedTime || null,
      actual:    f.arrival?.inGateTime    || null,
      terminal:  f.arrival?.terminal      || null,
      gate:      f.arrival?.gate          || null,
      delay:     0,
    },
  };
}

function getMockFlights(airport, type) {
  const now  = new Date();
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
