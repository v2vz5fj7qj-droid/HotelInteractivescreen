// Super-admin — Gestion des hôtels
// GET    /api/admin/super/hotels          ?search=&page=&per_page=
// GET    /api/admin/super/hotels/:id
// POST   /api/admin/super/hotels
// PUT    /api/admin/super/hotels/:id
// DELETE /api/admin/super/hotels/:id      (soft delete)
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'hotel', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

// Lister tous les hôtels (avec recherche + pagination optionnelle)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const conditions = [];
    const params     = [];
    if (search) { conditions.push('(h.nom LIKE ? OR h.slug LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Sans ?page → retourner tout (compatibilité avec les sélecteurs d'hôtels)
    if (!req.query.page) {
      const [rows] = await db.query(
        `SELECT h.*, hs.adresse, hs.telephone, hs.email_contact
         FROM hotels h LEFT JOIN hotel_settings hs ON hs.hotel_id = h.id
         ${where} ORDER BY h.nom`,
        params
      );
      return res.json(rows);
    }

    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.min(100, parseInt(req.query.per_page) || 25);
    const offset   = (page - 1) * per_page;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM hotels h ${where}`, params);
    const [rows] = await db.query(
      `SELECT h.*, hs.adresse, hs.telephone, hs.email_contact
       FROM hotels h LEFT JOIN hotel_settings hs ON hs.hotel_id = h.id
       ${where} ORDER BY h.nom LIMIT ? OFFSET ?`,
      [...params, per_page, offset]
    );
    res.json({ data: rows, total, page, per_page, total_pages: Math.ceil(total / per_page) });
  } catch (err) {
    console.error('[super/hotels GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un hôtel
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.*, hs.adresse, hs.telephone, hs.email_contact
       FROM hotels h LEFT JOIN hotel_settings hs ON hs.hotel_id = h.id
       WHERE h.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Hôtel introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/hotels GET/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un hôtel
router.post('/', async (req, res) => {
  try {
    const { slug, nom } = req.body;
    if (!slug || !nom) return res.status(400).json({ error: 'slug et nom requis' });

    const [result] = await db.query('INSERT INTO hotels (slug, nom) VALUES (?, ?)', [slug, nom]);
    const id = result.insertId;

    await db.query(
      `INSERT INTO hotel_settings (hotel_id, nom, theme_colors) VALUES (?, ?, ?)`,
      [id, nom, JSON.stringify({
        primary: '#C2782A', primary_dark: '#8B4F12',
        secondary: '#D4A843', accent: '#E8521A',
        bg_dark: '#1A1208', bg_light: '#FDF6EC',
        surface_dark: '#2C1E0A', surface_light: '#FFFFFF',
        text_dark: '#F5E6C8', text_light: '#2C1A06',
      })]
    );

    await auditLog(req.user.id, 'create', id, null, { slug, nom });
    const [rows] = await db.query('SELECT * FROM hotels WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce slug existe déjà' });
    console.error('[super/hotels POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un hôtel
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM hotels WHERE id = ?', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Hôtel introuvable' });

    const { slug, nom, is_active } = req.body;
    const fields = {};
    if (slug      !== undefined) fields.slug      = slug;
    if (nom       !== undefined) fields.nom        = nom;
    if (is_active !== undefined) fields.is_active  = is_active;

    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    await db.query('UPDATE hotels SET ? WHERE id = ?', [fields, req.params.id]);
    await auditLog(req.user.id, 'update', req.params.id, existing[0], fields);

    const [rows] = await db.query('SELECT * FROM hotels WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce slug existe déjà' });
    console.error('[super/hotels PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Désactiver un hôtel (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hotels WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hôtel introuvable' });
    await db.query('UPDATE hotels SET is_active = 0 WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'deactivate', req.params.id, { is_active: 1 }, { is_active: 0 });
    res.json({ message: 'Hôtel désactivé' });
  } catch (err) {
    console.error('[super/hotels DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
