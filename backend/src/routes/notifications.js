const express = require('express');
const router  = express.Router();
const db      = require('../services/db');
const cache   = require('../services/cacheService');

// GET /api/notifications — liste publique des notifications actives
router.get('/', async (_req, res) => {
  const CACHE_KEY = 'notifications:public';
  try {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(
      'SELECT id, message_fr, message_en, display_order FROM notifications WHERE is_active = 1 ORDER BY display_order ASC'
    );
    await cache.set(CACHE_KEY, JSON.stringify(rows), 60); // 1 min
    res.json(rows);
  } catch (err) {
    console.error('[Notifications]', err.message);
    res.json([]); // Ne pas bloquer la borne si la BDD est indisponible
  }
});

module.exports = router;
