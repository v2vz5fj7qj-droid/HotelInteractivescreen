const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/poi?locale=fr&category=restaurant
router.get('/', async (req, res) => {
  const locale   = req.query.locale   || 'fr';
  const category = req.query.category || null;
  const cacheKey = `poi:${locale}:${category || 'all'}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    let query = `
      SELECT
        p.id, p.category, p.lat, p.lng, p.phone, p.website,
        p.rating, p.price_level, p.display_order,
        COALESCE(t.name,        tf.name)        AS name,
        COALESCE(t.address,     tf.address)     AS address,
        COALESCE(t.description, tf.description) AS description
      FROM points_of_interest p
      LEFT JOIN poi_translations t  ON t.poi_id = p.id AND t.locale = ?
      LEFT JOIN poi_translations tf ON tf.poi_id = p.id AND tf.locale = 'fr'
      WHERE p.is_active = 1
    `;
    const params = [locale];
    if (category) { query += ' AND p.category = ?'; params.push(category); }
    query += ' ORDER BY p.display_order';

    const [rows] = await db.query(query, params);
    await cache.set(cacheKey, JSON.stringify(rows), 3600);
    res.json(rows);
  } catch (err) {
    console.error('[POI]', err.message);
    res.status(500).json({ error: 'Erreur chargement POI' });
  }
});

module.exports = router;
