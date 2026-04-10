const express = require('express');
const router  = express.Router();
const db      = require('../services/db');
const cache   = require('../services/cacheService');

// GET /api/notifications?hotel_id=1 — liste publique des notifications actives
router.get('/', async (req, res) => {
  const hotelId  = req.query.hotel_id ? parseInt(req.query.hotel_id) : null;
  const CACHE_KEY = `notifications:public:${hotelId || 'global'}`;
  try {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    let query = `SELECT id, message_fr, message_en, message_de, message_es, message_pt,
                        message_ar, message_zh, message_ja, message_ru, display_order
                 FROM notifications WHERE is_active = 1`;
    const params = [];
    if (hotelId) { query += ' AND hotel_id = ?'; params.push(hotelId); }
    query += ' ORDER BY display_order ASC';

    const [rows] = await db.query(query, params);
    await cache.set(CACHE_KEY, JSON.stringify(rows), 60); // 1 min
    res.json(rows);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.json([]); // Ne pas bloquer la borne si la BDD est indisponible
  }
});

module.exports = router;
