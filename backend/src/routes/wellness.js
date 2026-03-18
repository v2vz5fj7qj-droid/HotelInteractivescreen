const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/wellness?locale=fr
router.get('/', async (req, res) => {
  const locale   = req.query.locale || 'fr';
  const cacheKey = `wellness:list:${locale}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    const [rows] = await db.query(`
      SELECT
        ws.id, ws.slug, ws.duration_min, ws.price_fcfa,
        ws.image_url, ws.video_url, ws.contact_phone,
        ws.booking_info, ws.available_hours, ws.available_days,
        ws.max_per_day, ws.display_order,
        COALESCE(t.name,        tf.name)        AS name,
        COALESCE(t.description, tf.description) AS description,
        COALESCE(t.benefits,    tf.benefits)    AS benefits
      FROM wellness_services ws
      LEFT JOIN wellness_service_translations t
             ON t.service_id = ws.id AND t.locale = ?
      LEFT JOIN wellness_service_translations tf
             ON tf.service_id = ws.id AND tf.locale = 'fr'
      WHERE ws.is_active = 1
      ORDER BY ws.display_order
    `, [locale]);

    // Transformer les benefits en tableau
    const payload = rows.map(r => ({
      ...r,
      benefits: r.benefits ? r.benefits.split(';') : [],
    }));

    await cache.set(cacheKey, JSON.stringify(payload), 3600); // 1h
    res.json(payload);
  } catch (err) {
    console.error('[Wellness]', err.message);
    res.status(500).json({ error: 'Erreur chargement services' });
  }
});

// GET /api/wellness/:id?locale=fr
router.get('/:id', async (req, res) => {
  const locale = req.query.locale || 'fr';
  try {
    const [rows] = await db.query(`
      SELECT
        ws.*,
        COALESCE(t.name,        tf.name)        AS name,
        COALESCE(t.description, tf.description) AS description,
        COALESCE(t.benefits,    tf.benefits)    AS benefits
      FROM wellness_services ws
      LEFT JOIN wellness_service_translations t
             ON t.service_id = ws.id AND t.locale = ?
      LEFT JOIN wellness_service_translations tf
             ON tf.service_id = ws.id AND tf.locale = 'fr'
      WHERE ws.id = ? AND ws.is_active = 1
    `, [locale, req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Service introuvable' });

    const service = { ...rows[0], benefits: rows[0].benefits?.split(';') || [] };
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
