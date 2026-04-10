// Super-admin — Catégories globales de services (hotel_id = NULL)
// GET    /api/admin/super/service-categories
// POST   /api/admin/super/service-categories
// PUT    /api/admin/super/service-categories/:id
// DELETE /api/admin/super/service-categories/:id
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'service_category', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  ).catch(() => {});
}

// Lister les catégories globales
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM service_categories WHERE hotel_id IS NULL ORDER BY display_order'
    );
    res.json(rows);
  } catch (err) {
    console.error('[super/service-categories GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une catégorie globale
router.post('/', async (req, res) => {
  try {
    const { label_fr, label_en, icon, display_order } = req.body;
    if (!label_fr) return res.status(400).json({ error: 'label_fr requis' });

    const [result] = await db.query(
      `INSERT INTO service_categories (hotel_id, label_fr, label_en, icon, display_order, created_by)
       VALUES (NULL, ?, ?, ?, ?, ?)`,
      [label_fr, label_en || null, icon || '✨', display_order || 0, req.user.id]
    );
    const [rows] = await db.query('SELECT * FROM service_categories WHERE id = ?', [result.insertId]);
    await auditLog(req.user.id, 'create', result.insertId, null, { label_fr, icon });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[super/service-categories POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une catégorie globale
router.put('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM service_categories WHERE id = ? AND hotel_id IS NULL', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Catégorie globale introuvable' });

    const { label_fr, label_en, icon, display_order, is_active } = req.body;
    const fields = {};
    if (label_fr      !== undefined) fields.label_fr      = label_fr;
    if (label_en      !== undefined) fields.label_en      = label_en;
    if (icon          !== undefined) fields.icon          = icon;
    if (display_order !== undefined) fields.display_order = display_order;
    if (is_active     !== undefined) fields.is_active     = is_active;

    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucun champ à modifier' });
    await db.query('UPDATE service_categories SET ? WHERE id = ?', [fields, req.params.id]);
    await auditLog(req.user.id, 'update', req.params.id, rows[0], fields);
    const [updated] = await db.query('SELECT * FROM service_categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[super/service-categories PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une catégorie globale (vérifie qu'elle n'est pas utilisée)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM service_categories WHERE id = ? AND hotel_id IS NULL', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Catégorie globale introuvable' });

    const [usage] = await db.query(
      'SELECT COUNT(*) AS total FROM services WHERE category_id = ?', [req.params.id]
    );
    if (usage[0].total > 0) {
      return res.status(400).json({ error: `Catégorie utilisée par ${usage[0].total} service(s) — impossible de supprimer` });
    }

    await db.query('DELETE FROM service_categories WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'delete', req.params.id, rows[0], null);
    res.json({ message: 'Catégorie supprimée' });
  } catch (err) {
    console.error('[super/service-categories DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
