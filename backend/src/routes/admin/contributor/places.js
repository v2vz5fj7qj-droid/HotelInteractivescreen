// Contributeur — Mes lieux (can_submit_places requis)
// GET  /api/admin/contributor/places
// POST /api/admin/contributor/places
// PUT  /api/admin/contributor/places/:id  (uniquement ses soumissions pending/rejected)
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

// Vérifier la permission
function checkPermission(req, res) {
  if (!req.user.can_submit_places) {
    res.status(403).json({ error: 'Permission can_submit_places non accordée' });
    return false;
  }
  return true;
}

async function notifySuperAdmin(entityId, messageFr) {
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     SELECT id, 'submission_pending', 'place', ?, ?
     FROM admin_users WHERE role = 'super_admin' AND is_active = 1`,
    [entityId, messageFr]
  );
}

// Mes soumissions
router.get('/', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const [rows] = await db.query(
      `SELECT p.*, pt.name, pt.address
       FROM points_of_interest p
       LEFT JOIN poi_translations pt ON pt.poi_id = p.id AND pt.locale = 'fr'
       WHERE p.created_by = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[contributor/places GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Soumettre un lieu (status: pending)
router.post('/', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const { category, lat, lng, phone, website, rating, price_level, display_order, translations } = req.body;
    if (!category || !lat || !lng) return res.status(400).json({ error: 'category, lat, lng requis' });

    const [result] = await db.query(
      `INSERT INTO points_of_interest
         (category, lat, lng, phone, website, rating, price_level, display_order, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [category, lat, lng, phone || null, website || null, rating || null,
       price_level || null, display_order || 0, req.user.id]
    );
    const id = result.insertId;

    if (translations?.length) {
      for (const t of translations) {
        await db.query(
          'INSERT INTO poi_translations (poi_id, locale, name, address, description) VALUES (?, ?, ?, ?, ?)',
          [id, t.locale, t.name, t.address || null, t.description || null]
        );
      }
    }

    await notifySuperAdmin(id, `Nouveau lieu soumis par ${req.user.id} — en attente de validation.`);
    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[contributor/places POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier sa soumission (uniquement si pending ou rejected)
router.put('/:id', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const [rows] = await db.query(
      `SELECT * FROM points_of_interest WHERE id = ? AND created_by = ? AND status IN ('pending','rejected')`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Soumission introuvable ou non modifiable' });

    const allowed = ['category', 'lat', 'lng', 'phone', 'website', 'rating', 'price_level'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

    // Repasser en pending si c'était rejected et qu'on remodifie
    if (rows[0].status === 'rejected') fields.status = 'pending';

    if (Object.keys(fields).length) {
      await db.query('UPDATE points_of_interest SET ? WHERE id = ?', [fields, req.params.id]);
    }

    if (req.body.translations?.length) {
      for (const t of req.body.translations) {
        await db.query(
          `INSERT INTO poi_translations (poi_id, locale, name, address, description)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), description=VALUES(description)`,
          [req.params.id, t.locale, t.name, t.address || null, t.description || null]
        );
      }
    }

    if (rows[0].status === 'rejected') {
      await notifySuperAdmin(req.params.id, `Lieu resoumis après correction par contributeur ${req.user.id}.`);
    }

    const [updated] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[contributor/places PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
