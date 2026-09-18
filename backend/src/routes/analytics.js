// Analytics kiosque — enregistrement des interactions et consultation des stats.
// Les événements sont non-bloquants : une erreur DB n'empêche pas l'action utilisateur.
// POST /api/analytics         — enregistrer un clic/navigation (appelé par trackEvent)
// GET  /api/analytics/summary — stats par section sur les dernières 24h (backoffice)
const express = require('express');
const db      = require('../services/db');
const router  = express.Router();

// POST /api/analytics — Enregistrer un événement
router.post('/', async (req, res) => {
  const { section, action, meta, locale, device_type, session_id } = req.body;
  if (!section) return res.status(400).json({ error: 'section requise' });

  try {
    await db.query(
      `INSERT INTO analytics_events (section, action, meta, locale, device_type, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [section, action || null, meta ? JSON.stringify(meta) : null,
       locale || 'fr', device_type || 'kiosk', session_id || null]
    );
    res.json({ ok: true });
  } catch (err) {
    // Ne pas bloquer l'app si analytics échoue
    res.json({ ok: false });
  }
});

// GET /api/analytics/summary — Stats par section (dernières 24h)
router.get('/summary', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        section,
        COUNT(*) AS total,
        COUNT(DISTINCT session_id) AS unique_sessions,
        DATE_FORMAT(MIN(created_at), '%H:00') AS first_event,
        DATE_FORMAT(MAX(created_at), '%H:00') AS last_event
      FROM analytics_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY section
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur stats' });
  }
});

module.exports = router;
