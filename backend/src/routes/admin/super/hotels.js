// Super-admin — Gestion des hôtels
// GET    /api/admin/super/hotels
// GET    /api/admin/super/hotels/:id
// POST   /api/admin/super/hotels
// PUT    /api/admin/super/hotels/:id
// DELETE /api/admin/super/hotels/:id
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

// Lister tous les hôtels
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hotels ORDER BY nom');
    res.json(rows);
  } catch (err) {
    console.error('[super/hotels GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un hôtel
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hotels WHERE id = ?', [req.params.id]);
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

    const [result] = await db.query(
      'INSERT INTO hotels (slug, nom) VALUES (?, ?)',
      [slug, nom]
    );
    const [rows] = await db.query('SELECT * FROM hotels WHERE id = ?', [result.insertId]);

    // Créer les hotel_settings par défaut
    await db.query(
      `INSERT INTO hotel_settings (hotel_id, nom, theme_colors)
       VALUES (?, ?, ?)`,
      [result.insertId, nom, JSON.stringify({
        primary: '#C2782A', primary_dark: '#8B4F12',
        secondary: '#D4A843', accent: '#E8521A',
        bg_dark: '#1A1208', bg_light: '#FDF6EC',
        surface_dark: '#2C1E0A', surface_light: '#FFFFFF',
        text_dark: '#F5E6C8', text_light: '#2C1A06',
      })]
    );

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
    const { slug, nom, is_active } = req.body;
    const fields = {};
    if (slug      !== undefined) fields.slug      = slug;
    if (nom       !== undefined) fields.nom        = nom;
    if (is_active !== undefined) fields.is_active  = is_active;

    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    await db.query('UPDATE hotels SET ? WHERE id = ?', [fields, req.params.id]);
    const [rows] = await db.query('SELECT * FROM hotels WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hôtel introuvable' });
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
    res.json({ message: 'Hôtel désactivé' });
  } catch (err) {
    console.error('[super/hotels DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
