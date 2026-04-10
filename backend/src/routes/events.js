const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/events?hotel_id=1&locale=fr&category=music&upcoming=true&limit=20
router.get('/', async (req, res) => {
  const hotelId  = req.query.hotel_id ? parseInt(req.query.hotel_id) : null;
  const locale   = req.query.locale   || 'fr';
  const category = req.query.category || null;
  const upcoming = req.query.upcoming !== 'false';   // true par défaut
  const featured = req.query.featured === 'true';
  const limit    = Math.min(parseInt(req.query.limit || '20', 10), 50);

  const cacheKey = `events:${hotelId||'global'}:${locale}:${category||'all'}:${upcoming}:${featured}:${limit}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    let query = `
      SELECT
        e.id, e.slug, e.category,
        e.start_date, e.end_date, e.start_time, e.end_time,
        e.location, e.lat, e.lng, e.price_fcfa,
        e.image_url, e.is_featured, e.display_order,
        COALESCE(t.title,       tf.title)       AS title,
        COALESCE(t.description, tf.description) AS description,
        COALESCE(t.tags,        tf.tags)        AS tags
      FROM events e
      LEFT JOIN event_translations t  ON t.event_id = e.id AND t.locale = ?
      LEFT JOIN event_translations tf ON tf.event_id = e.id AND tf.locale = 'fr'
      WHERE e.status = 'published'
    `;
    const params = [locale];

    if (hotelId) {
      query += ' AND e.hotel_id = ?'; params.push(hotelId);
    }
    if (upcoming) {
      query += ' AND (e.end_date >= CURDATE() OR (e.end_date IS NULL AND e.start_date >= CURDATE()))';
    }
    if (category) { query += ' AND e.category = ?'; params.push(category); }
    if (featured)  { query += ' AND e.is_featured = 1'; }

    query += ' ORDER BY e.start_date ASC, e.display_order ASC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(query, params);

    const payload = rows.map(r => ({
      ...r,
      tags:       r.tags ? r.tags.split(',') : [],
      is_free:    r.price_fcfa === 0,
      is_hotel:   r.category === 'hotel',
    }));

    await cache.set(cacheKey, JSON.stringify(payload), 1800); // 30 min
    res.json(payload);
  } catch (err) {
    console.error('[Events]', err.message);
    res.json(getMockEvents(locale));
  }
});

// GET /api/events/categories  (public, cached 1h)
router.get('/categories', async (req, res) => {
  const cached = await cache.get('events:categories');
  if (cached) return res.json(JSON.parse(cached));
  try {
    const [rows] = await db.query(
      'SELECT * FROM event_categories WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
    );
    await cache.set('events:categories', JSON.stringify(rows), 3600);
    res.json(rows);
  } catch (err) {
    console.error('[Events/categories]', err.message);
    res.json([]);
  }
});

// GET /api/events/:id?locale=fr
router.get('/:id', async (req, res) => {
  const locale = req.query.locale || 'fr';
  try {
    const [rows] = await db.query(`
      SELECT e.*,
        COALESCE(t.title,       tf.title)       AS title,
        COALESCE(t.description, tf.description) AS description,
        COALESCE(t.tags,        tf.tags)        AS tags
      FROM events e
      LEFT JOIN event_translations t  ON t.event_id = e.id AND t.locale = ?
      LEFT JOIN event_translations tf ON tf.event_id = e.id AND tf.locale = 'fr'
      WHERE e.id = ? AND e.is_active = 1
    `, [locale, req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Événement introuvable' });

    const ev = { ...rows[0], tags: rows[0].tags?.split(',') || [], is_free: rows[0].price_fcfa === 0 };
    res.json(ev);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Données mock offline
function getMockEvents(locale) {
  const isFr = locale === 'fr';
  return [
    {
      id: 1, slug: 'jazz-calebasse', category: 'music',
      start_date: '2026-03-20', end_date: '2026-03-22',
      start_time: '19:00:00', end_time: '23:00:00',
      location: 'Jardin de Zaka', lat: 12.3680, lng: -1.5180,
      price_fcfa: 5000, is_featured: true,
      title:       isFr ? 'Jazz à la Calebasse'   : 'Jazz at La Calebasse',
      description: isFr ? 'Trois nuits de jazz et musiques du monde.' : 'Three nights of jazz and world music.',
      tags: isFr ? ['jazz','musique','concert'] : ['jazz','music','concert'],
      is_free: false,
    },
    {
      id: 2, slug: 'nuit-gastronomie', category: 'hotel',
      start_date: '2026-03-28', end_date: null,
      start_time: '18:30:00', end_time: '23:30:00',
      location: isFr ? 'Hôtel ConnectBé' : 'ConnectBé Hotel',
      lat: 12.3641, lng: -1.5332, price_fcfa: 15000, is_featured: true,
      title:       isFr ? 'Nuit Gastronomique ConnectBé' : 'ConnectBé Gourmet Evening',
      description: isFr ? 'Soirée dégustation exclusive par notre Chef.' : 'Exclusive tasting evening by our Chef.',
      tags: isFr ? ['gastronomie','hôtel','dîner'] : ['gastronomy','hotel','dinner'],
      is_free: false,
    },
  ];
}

module.exports = router;
