const express = require('express');
const Feedback = require('../../../models/feedback');

const router = express.Router();

// Super-admin peut passer ?hotel_id=X pour gérer n'importe quel hôtel
function resolveHotelId(req) {
  if (req.user?.role === 'super_admin' && req.query.hotel_id) {
    return parseInt(req.query.hotel_id);
  }
  return req.hotelId;
}

// GET /api/admin/hotel/feedbacks?from=&to=&min_note=&limit=&offset=
router.get('/', async (req, res) => {
  const hotel_id = resolveHotelId(req);
  if (!hotel_id) return res.status(400).json({ error: 'Contexte hôtel manquant' });

  const { from, to, min_note, limit = 50, offset = 0 } = req.query;
  const data = await Feedback.list({ hotel_id, from, to, min_note, limit, offset });
  res.json(data);
});

// GET /api/admin/hotel/feedbacks/stats
router.get('/stats', async (req, res) => {
  const hotel_id = resolveHotelId(req);
  if (!hotel_id) return res.status(400).json({ error: 'Contexte hôtel manquant' });
  const data = await Feedback.stats(hotel_id);
  res.json(data);
});

// GET /api/admin/hotel/feedbacks/export — téléchargement CSV
router.get('/export', async (req, res) => {
  const hotel_id = resolveHotelId(req);
  if (!hotel_id) return res.status(400).json({ error: 'Contexte hôtel manquant' });

  const { from, to, min_note } = req.query;
  const { rows } = await Feedback.list({ hotel_id, from, to, min_note, limit: 5000, offset: 0 });

  const escape = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };

  const header = 'Date,Note globale,Propreté,Accueil,Chambre,Restauration,Services,Commentaire,Langue\n';
  const lines  = rows.map(r => {
    const cats = typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories;
    return [
      r.created_at.toISOString().slice(0, 16).replace('T', ' '),
      r.note_globale,
      cats.proprete    ?? '',
      cats.accueil     ?? '',
      cats.chambre     ?? '',
      cats.restauration?? '',
      cats.services    ?? '',
      escape(r.commentaire),
      r.locale,
    ].join(',');
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="feedbacks.csv"');
  res.send('﻿' + header + lines); // BOM pour Excel
});

module.exports = router;
