// Route publique kiosque — Services de l'hôtel
// GET /api/services?hotel_id=1&locale=fr
const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

router.get('/', async (req, res) => {
  const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id) : null;
  const locale  = req.query.locale || 'fr';

  if (!hotelId) return res.json([]);

  const cacheKey = `services:public:${hotelId}:${locale}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(
      `SELECT
         s.id, s.slug, s.image_url, s.contact_phone,
         s.available_hours, s.available_days, s.display_order,
         s.price_fcfa, s.duration_min,
         COALESCE(sc_h.label_fr, sc_g.label_fr) AS category_label_fr,
         COALESCE(sc_h.label_en, sc_g.label_en) AS category_label_en,
         COALESCE(sc_h.icon,     sc_g.icon)     AS category_icon,
         COALESCE(t.name,        tf.name)        AS name,
         COALESCE(t.description, tf.description) AS description,
         COALESCE(t.benefits,    tf.benefits)    AS benefits
       FROM services s
       LEFT JOIN service_categories sc_h ON sc_h.id = s.category_id AND sc_h.hotel_id = s.hotel_id
       LEFT JOIN service_categories sc_g ON sc_g.id = s.category_id AND sc_g.hotel_id IS NULL
       LEFT JOIN service_translations t  ON t.service_id = s.id AND t.locale = ?
       LEFT JOIN service_translations tf ON tf.service_id = s.id AND tf.locale = 'fr'
       WHERE s.hotel_id = ? AND s.is_active = 1
       ORDER BY s.display_order ASC, s.id ASC`,
      [locale, hotelId]
    );

    const payload = rows.map(r => ({
      ...r,
      benefits: r.benefits ? r.benefits.split(';') : [],
    }));

    await cache.set(cacheKey, JSON.stringify(payload), 300); // 5 min
    res.json(payload);
  } catch (err) {
    console.error('[services public]', err.message);
    res.json([]);
  }
});

module.exports = router;
