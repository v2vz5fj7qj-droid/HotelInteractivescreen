// Gestion des bornes kiosques — hotel-admin
// GET /api/admin/hotel/kiosks              — bornes de l'hôtel courant
// PUT /api/admin/hotel/kiosks/:id/toggle   — activer / désactiver
const express = require('express');
const db      = require('../../../services/db');

const router  = express.Router();

// GET /api/admin/hotel/kiosks
router.get('/', async (req, res) => {
  const hotelId = req.hotelId;

  try {
    const [rows] = await db.query(
      `SELECT k.id, k.label, k.fingerprint, k.is_enabled, k.last_seen_at, k.registered_at,
              CASE
                WHEN k.is_enabled = 0 THEN 'disabled'
                WHEN k.last_seen_at IS NULL THEN 'never_seen'
                WHEN k.last_seen_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 'online'
                ELSE 'offline'
              END AS status
       FROM kiosks k
       WHERE k.hotel_id = ?
       ORDER BY k.registered_at DESC`,
      [hotelId]
    );

    return res.json(rows);
  } catch (err) {
    console.error('[hotel/kiosks GET]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/hotel/kiosks/:id/toggle
router.put('/:id/toggle', async (req, res) => {
  const hotelId = req.hotelId;
  const { id }  = req.params;

  try {
    const [[kiosk]] = await db.query(
      'SELECT id, is_enabled FROM kiosks WHERE id = ? AND hotel_id = ?',
      [id, hotelId]
    );
    if (!kiosk) return res.status(404).json({ error: 'Borne introuvable' });

    const newState = kiosk.is_enabled ? 0 : 1;
    await db.query('UPDATE kiosks SET is_enabled = ? WHERE id = ?', [newState, id]);

    return res.json({ is_enabled: newState });
  } catch (err) {
    console.error('[hotel/kiosks/toggle PUT]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
