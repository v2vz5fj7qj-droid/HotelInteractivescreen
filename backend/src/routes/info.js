const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/info/categories?hotel_id=
router.get('/categories', async (req, res) => {
  const hotelId  = req.query.hotel_id ? parseInt(req.query.hotel_id, 10) : null;
  const cacheKey = `info:categories:${hotelId || 'global'}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));
  try {
    let rows;
    if (hotelId) {
      [rows] = await db.query(
        'SELECT * FROM info_categories WHERE is_active=1 AND (hotel_id IS NULL OR hotel_id = ?) ORDER BY display_order, id',
        [hotelId]
      );
    } else {
      [rows] = await db.query(
        'SELECT * FROM info_categories WHERE is_active=1 ORDER BY display_order, id'
      );
    }
    await cache.set(cacheKey, JSON.stringify(rows), 3600);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement catégories infos' });
  }
});

// GET /api/info?locale=fr&category=taxi&hotel_id=
router.get('/', async (req, res) => {
  const locale   = req.query.locale   || 'fr';
  const category = req.query.category || null;
  const hotelId  = req.query.hotel_id ? parseInt(req.query.hotel_id, 10) : null;
  const cacheKey = `info:${hotelId || 'global'}:${locale}:${category || 'all'}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    let query = `
      SELECT
        c.id, c.category, c.phone, c.whatsapp, c.website, c.available_24h,
        c.display_order,
        COALESCE(t.name,        tf.name)        AS name,
        COALESCE(t.description, tf.description) AS description,
        COALESCE(t.address,     tf.address)     AS address
      FROM useful_contacts c
      LEFT JOIN useful_contact_translations t  ON t.contact_id = c.id AND t.locale = ?
      LEFT JOIN useful_contact_translations tf ON tf.contact_id = c.id AND tf.locale = 'fr'
    `;
    const params = [locale];

    if (hotelId) {
      query += ' JOIN hotel_info hi ON hi.info_id = c.id AND hi.hotel_id = ?';
      params.push(hotelId);
    }

    query += ' WHERE c.status = \'published\'';
    if (category) { query += ' AND c.category = ?'; params.push(category); }
    query += ' ORDER BY c.display_order';

    const [rows] = await db.query(query, params);
    await cache.set(cacheKey, JSON.stringify(rows), 3600);
    res.json(rows);
  } catch (err) {
    console.error('[Info]', err.message);
    res.status(500).json({ error: 'Erreur chargement contacts' });
  }
});

module.exports = router;
