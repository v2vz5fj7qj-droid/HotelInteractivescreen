const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/info?locale=fr&category=taxi
router.get('/', async (req, res) => {
  const locale   = req.query.locale   || 'fr';
  const category = req.query.category || null;
  const cacheKey = `info:${locale}:${category || 'all'}`;
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
      WHERE c.is_active = 1
    `;
    const params = [locale];
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
