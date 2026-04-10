// Hotel-admin — Notifications rotatives de la borne kiosque
// GET    /api/admin/hotel/notifications
// POST   /api/admin/hotel/notifications
// PUT    /api/admin/hotel/notifications/:id
// DELETE /api/admin/hotel/notifications/:id
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) return parseInt(req.query.hotel_id);
  return req.hotelId;
}

router.get('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE hotel_id = ? ORDER BY display_order',
      [hotelId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[hotel/notifications GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const { message_fr, message_en, message_de, message_es, message_pt,
            message_ar, message_zh, message_ja, message_ru, display_order } = req.body;
    if (!message_fr) return res.status(400).json({ error: 'message_fr requis' });

    const [result] = await db.query(
      `INSERT INTO notifications
         (hotel_id, message_fr, message_en, message_de, message_es, message_pt,
          message_ar, message_zh, message_ja, message_ru, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [hotelId, message_fr, message_en || null, message_de || null, message_es || null,
       message_pt || null, message_ar || null, message_zh || null, message_ja || null,
       message_ru || null, display_order || 0]
    );
    const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[hotel/notifications POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification introuvable' });

    const allowed = ['message_fr','message_en','message_de','message_es','message_pt',
                     'message_ar','message_zh','message_ja','message_ru','display_order','is_active'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

    await db.query('UPDATE notifications SET ? WHERE id = ?', [fields, req.params.id]);
    const [updated] = await db.query('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[hotel/notifications PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT id FROM notifications WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification introuvable' });
    await db.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification supprimée' });
  } catch (err) {
    console.error('[hotel/notifications DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
