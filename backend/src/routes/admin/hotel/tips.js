// Hotel-admin — Bon à savoir (contenu propre à l'hôtel)
// GET    /api/admin/hotel/tips
// POST   /api/admin/hotel/tips
// PUT    /api/admin/hotel/tips/:id
// DELETE /api/admin/hotel/tips/:id
//
// Traductions : FR + EN via colonnes directes ; autres langues via translations_json TEXT.
// Format translations_json : { "de": { "titre": "...", "contenu": "..." }, "es": { ... }, ... }
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

const EXTRA_LOCALES = ['de', 'es', 'pt', 'ar', 'zh', 'ja', 'ru'];

function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) return parseInt(req.query.hotel_id);
  return req.hotelId;
}

/** Normalise une ligne DB en objet enrichi d'un tableau `translations` homogène */
function normalize(row) {
  let extra = {};
  try { extra = JSON.parse(row.translations_json || '{}'); } catch {}
  const translations = [
    { locale: 'fr', titre: row.titre_fr || '', contenu: row.contenu_fr || '' },
    { locale: 'en', titre: row.titre_en || '', contenu: row.contenu_en || '' },
    ...EXTRA_LOCALES.map(l => ({
      locale: l,
      titre:  extra[l]?.titre   || '',
      contenu: extra[l]?.contenu || '',
    })),
  ];
  const { translations_json, ...rest } = row;
  return { ...rest, translations };
}

router.get('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const [rows] = await db.query(
      'SELECT * FROM hotel_tips WHERE hotel_id = ? ORDER BY display_order, created_at DESC',
      [hotelId]
    );
    res.json(rows.map(normalize));
  } catch (err) {
    console.error('[hotel/tips GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const { titre_fr, titre_en, contenu_fr, contenu_en, categorie, display_order, translations_extra } = req.body;
    if (!titre_fr || !contenu_fr) return res.status(400).json({ error: 'titre_fr et contenu_fr requis' });

    const extra = {};
    if (translations_extra && typeof translations_extra === 'object') {
      for (const locale of EXTRA_LOCALES) {
        if (translations_extra[locale]) extra[locale] = translations_extra[locale];
      }
    }

    const [result] = await db.query(
      `INSERT INTO hotel_tips
         (hotel_id, created_by, titre_fr, titre_en, contenu_fr, contenu_en, categorie, display_order, translations_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [hotelId, req.user.id, titre_fr, titre_en || null, contenu_fr, contenu_en || null,
       categorie || null, display_order || 0,
       Object.keys(extra).length ? JSON.stringify(extra) : null]
    );
    const [rows] = await db.query('SELECT * FROM hotel_tips WHERE id = ?', [result.insertId]);
    res.status(201).json(normalize(rows[0]));
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

    // Langues supplémentaires
    if (req.body.translations_extra && typeof req.body.translations_extra === 'object') {
      let existing = {};
      try { existing = JSON.parse(rows[0].translations_json || '{}'); } catch {}
      const merged = { ...existing };
      for (const locale of EXTRA_LOCALES) {
        if (req.body.translations_extra[locale] !== undefined) {
          merged[locale] = req.body.translations_extra[locale];
        }
      }
      fields.translations_json = Object.keys(merged).length ? JSON.stringify(merged) : null;
    }

    if (Object.keys(fields).length) {
      await db.query('UPDATE hotel_tips SET ? WHERE id = ?', [fields, req.params.id]);
    }
    const [updated] = await db.query('SELECT * FROM hotel_tips WHERE id = ?', [req.params.id]);
    res.json(normalize(updated[0]));
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
