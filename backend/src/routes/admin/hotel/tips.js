// Hotel-admin — Bon à savoir (contenu propre à l'hôtel)
// GET    /api/admin/hotel/tips
// POST   /api/admin/hotel/tips
// PUT    /api/admin/hotel/tips/:id
// DELETE /api/admin/hotel/tips/:id
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
      'SELECT * FROM hotel_tips WHERE hotel_id = ? ORDER BY display_order, created_at DESC',
      [hotelId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[hotel/tips GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const { titre_fr, titre_en, contenu_fr, contenu_en, categorie, display_order } = req.body;
    if (!titre_fr || !contenu_fr) return res.status(400).json({ error: 'titre_fr et contenu_fr requis' });

    const [result] = await db.query(
      `INSERT INTO hotel_tips (hotel_id, created_by, titre_fr, titre_en, contenu_fr, contenu_en, categorie, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [hotelId, req.user.id, titre_fr, titre_en || null, contenu_fr, contenu_en || null, categorie || null, display_order || 0]
    );
    const [rows] = await db.query('SELECT * FROM hotel_tips WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[hotel/tips POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM hotel_tips WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Conseil introuvable' });

    const allowed = ['titre_fr', 'titre_en', 'contenu_fr', 'contenu_en', 'categorie', 'display_order', 'is_active'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

    await db.query('UPDATE hotel_tips SET ? WHERE id = ?', [fields, req.params.id]);
    const [updated] = await db.query('SELECT * FROM hotel_tips WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[hotel/tips PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT id FROM hotel_tips WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Conseil introuvable' });
    await db.query('DELETE FROM hotel_tips WHERE id = ?', [req.params.id]);
    res.json({ message: 'Conseil supprimé' });
  } catch (err) {
    console.error('[hotel/tips DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
