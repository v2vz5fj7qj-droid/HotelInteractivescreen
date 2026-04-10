// Route publique kiosque — Bons à savoir de l'hôtel
// GET /api/tips?hotel_id=1&locale=fr
const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

router.get('/', async (req, res) => {
  const hotelId = req.query.hotel_id ? parseInt(req.query.hotel_id) : null;
  const locale  = req.query.locale || 'fr';

  if (!hotelId) return res.json([]);

  const cacheKey = `tips:public:${hotelId}:${locale}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(
      `SELECT
         id, categorie, display_order,
         CASE WHEN ? = 'en' AND titre_en IS NOT NULL THEN titre_en ELSE titre_fr END AS titre,
         CASE WHEN ? = 'en' AND contenu_en IS NOT NULL THEN contenu_en ELSE contenu_fr END AS contenu
       FROM hotel_tips
       WHERE hotel_id = ? AND is_active = 1
       ORDER BY display_order ASC, created_at DESC`,
      [locale, locale, hotelId]
    );

    await cache.set(cacheKey, JSON.stringify(rows), 300); // 5 min
    res.json(rows);
  } catch (err) {
    console.error('[tips public]', err.message);
    res.json([]);
  }
});

module.exports = router;
