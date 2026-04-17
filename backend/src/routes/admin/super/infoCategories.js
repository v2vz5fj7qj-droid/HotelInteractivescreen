// Super-admin — Catégories Infos utiles
// hotel_id = NULL  → catégorie globale
// hotel_id = <id>  → catégorie propre à un hôtel
//
// GET    /api/admin/super/info-categories
// POST   /api/admin/super/info-categories
// PUT    /api/admin/super/info-categories/:id
// DELETE /api/admin/super/info-categories/:id
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'info_category', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  ).catch(() => {});
}

// Lister
router.get('/', async (req, res) => {
  try {
    const { hotel_id } = req.query;
    let query  = 'SELECT ic.*, h.nom AS hotel_name FROM info_categories ic LEFT JOIN hotels h ON h.id = ic.hotel_id';
    const params = [];
    if (hotel_id) {
      query += ' WHERE ic.hotel_id = ? OR ic.hotel_id IS NULL';
      params.push(hotel_id);
    }
    query += ' ORDER BY ic.hotel_id IS NOT NULL, ic.display_order, ic.id';
    const [rows] = await db.query(query, params);

    // Catégories utilisées dans useful_contacts mais absentes de info_categories
    const [orphans] = await db.query(
      `SELECT DISTINCT category AS key_name FROM useful_contacts
       WHERE category IS NOT NULL AND TRIM(category) != ''
         AND category NOT IN (SELECT key_name FROM info_categories)`
    );
    const orphanRows = orphans.map(o => ({
      id: null, hotel_id: null, hotel_name: null,
      key_name: o.key_name, label_fr: o.key_name, label_en: null,
      icon: '❓', color: '#6B7280', display_order: 999,
      is_active: true, created_by: null, created_at: null,
      is_orphan: true,
    }));

    res.json([...rows, ...orphanRows]);
  } catch (err) {
    console.error('[super/info-categories GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer
router.post('/', async (req, res) => {
  try {
    const { key_name, label_fr, label_en, icon, color, display_order, hotel_id } = req.body;
    if (!key_name) return res.status(400).json({ error: 'key_name requis' });
    if (!/^[a-z0-9_]+$/.test(key_name)) return res.status(400).json({ error: 'key_name : uniquement lettres minuscules, chiffres et _ autorisés' });
    if (!label_fr) return res.status(400).json({ error: 'label_fr requis' });

    const [existing] = await db.query(
      'SELECT id FROM info_categories WHERE key_name = ? AND (hotel_id = ? OR (hotel_id IS NULL AND ? IS NULL))',
      [key_name, hotel_id || null, hotel_id || null]
    );
    if (existing.length) return res.status(409).json({ error: 'Ce key_name existe déjà pour cet hôtel' });

    const [result] = await db.query(
      `INSERT INTO info_categories (key_name, label_fr, label_en, icon, color, display_order, hotel_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [key_name, label_fr, label_en || null, icon || '📋', color || '#6B7280',
       display_order || 0, hotel_id || null, req.user.id]
    );
    const [rows] = await db.query('SELECT * FROM info_categories WHERE id = ?', [result.insertId]);
    await auditLog(req.user.id, 'create', result.insertId, null, { key_name, label_fr, hotel_id });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[super/info-categories POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier
router.put('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM info_categories WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Catégorie introuvable' });

    const { label_fr, label_en, icon, color, display_order, is_active, hotel_id } = req.body;
    const fields = {};
    if (label_fr      !== undefined) fields.label_fr      = label_fr;
    if (label_en      !== undefined) fields.label_en      = label_en;
    if (icon          !== undefined) fields.icon          = icon;
    if (color         !== undefined) fields.color         = color;
    if (display_order !== undefined) fields.display_order = display_order;
    if (is_active     !== undefined) fields.is_active     = is_active;
    if (hotel_id      !== undefined) fields.hotel_id      = hotel_id || null;

    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucun champ à modifier' });
    await db.query('UPDATE info_categories SET ? WHERE id = ?', [fields, req.params.id]);
    await auditLog(req.user.id, 'update', req.params.id, rows[0], fields);
    const [updated] = await db.query('SELECT * FROM info_categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[super/info-categories PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer — vérifie qu'aucun contact utile n'utilise cette catégorie
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM info_categories WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Catégorie introuvable' });

    const [usage] = await db.query(
      'SELECT COUNT(*) AS total FROM useful_contacts WHERE category = ?', [rows[0].key_name]
    );
    if (usage[0].total > 0) {
      return res.status(400).json({
        error: `Catégorie utilisée par ${usage[0].total} contact(s) — impossible de supprimer`
      });
    }

    await db.query('DELETE FROM info_categories WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'delete', req.params.id, rows[0], null);
    res.json({ message: 'Catégorie supprimée' });
  } catch (err) {
    console.error('[super/info-categories DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
