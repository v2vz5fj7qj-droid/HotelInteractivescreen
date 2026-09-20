// Route publique kiosque — distance à pied entre deux points (hôtel ↔ POI)
// Proxifie OpenRouteService côté serveur : la clé ne doit jamais être exposée au navigateur.
// GET /api/directions/walking?from_lat=&from_lng=&to_lat=&to_lng=
const express = require('express');
const axios   = require('axios');
const cache   = require('../services/cacheService');
const router  = express.Router();

const ORS_KEY   = process.env.ORS_API_KEY;
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 jours — les coordonnées hôtel/POI ne bougent quasiment jamais

// Arrondi à ~11m de précision : suffisant pour l'affichage et limite la cardinalité du cache
const round = (n) => Math.round(n * 10000) / 10000;

router.get('/walking', async (req, res) => {
  const fromLat = parseFloat(req.query.from_lat);
  const fromLng = parseFloat(req.query.from_lng);
  const toLat   = parseFloat(req.query.to_lat);
  const toLng   = parseFloat(req.query.to_lng);

  if ([fromLat, fromLng, toLat, toLng].some(Number.isNaN)) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }
  if (!ORS_KEY) {
    return res.status(503).json({ error: 'Service indisponible' });
  }

  const key = `directions:walk:${round(fromLat)},${round(fromLng)}:${round(toLat)},${round(toLng)}`;

  try {
    const cached = await cache.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const { data } = await axios.post(
      'https://api.openrouteservice.org/v2/directions/foot-walking',
      { coordinates: [[fromLng, fromLat], [toLng, toLat]] },
      { headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' }, timeout: 8000 }
    );

    const meters = data?.routes?.[0]?.summary?.distance;
    if (!meters) return res.json({ meters: null });

    const payload = { meters };
    await cache.set(key, JSON.stringify(payload), CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[directions/walking]', err.message);
    res.json({ meters: null }); // fallback : le front bascule sur la distance à vol d'oiseau
  }
});

module.exports = router;
