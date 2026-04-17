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
      `SELECT id, categorie, display_order, titre_fr, titre_en, contenu_fr, contenu_en, translations_json
       FROM hotel_tips
       WHERE hotel_id = ? AND is_active = 1
       ORDER BY display_order ASC, created_at DESC`,
      [hotelId]
    );

    const resolved = rows.map(row => {
      let extra = {};
      try { extra = JSON.parse(row.translations_json || '{}'); } catch {}

      const titre   = extra[locale]?.titre   || (locale === 'en' ? row.titre_en   : null) || row.titre_fr;
      const contenu = extra[locale]?.contenu || (locale === 'en' ? row.contenu_en : null) || row.contenu_fr;

      return { id: row.id, categorie: row.categorie, display_order: row.display_order, titre, contenu };
    });

    await cache.set(cacheKey, JSON.stringify(resolved), 300); // 5 min
    res.json(resolved);
  } catch (err) {
    console.error('[tips public]', err.message);
    res.json([]);
  }
});

module.exports = router;
