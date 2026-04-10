// Contributeur — Mes infos utiles (can_submit_info requis)
// GET  /api/admin/contributor/info
// POST /api/admin/contributor/info
// PUT  /api/admin/contributor/info/:id
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

function checkPermission(req, res) {
  if (!req.user.can_submit_info) {
    res.status(403).json({ error: 'Permission can_submit_info non accordée' });
    return false;
  }
  return true;
}

async function notifySuperAdmin(entityId, messageFr) {
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     SELECT id, 'submission_pending', 'useful_info', ?, ?
     FROM admin_users WHERE role = 'super_admin' AND is_active = 1`,
    [entityId, messageFr]
  );
}

router.get('/', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const [rows] = await db.query(
      `SELECT u.*, uct.name, uct.description
       FROM useful_contacts u
       LEFT JOIN useful_contact_translations uct ON uct.contact_id = u.id AND uct.locale = 'fr'
       WHERE u.created_by = ?
       ORDER BY u.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[contributor/info GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const { category, phone, whatsapp, website, available_24h, display_order, translations } = req.body;
    if (!category) return res.status(400).json({ error: 'category requis' });

    const [result] = await db.query(
      `INSERT INTO useful_contacts
         (category, phone, whatsapp, website, available_24h, display_order, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [category, phone || null, whatsapp || null, website || null,
       available_24h || 0, display_order || 0, req.user.id]
    );
    const id = result.insertId;

    if (translations?.length) {
      for (const t of translations) {
        await db.query(
          'INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES (?, ?, ?, ?, ?)',
          [id, t.locale, t.name, t.description || null, t.address || null]
        );
      }
    }

    await notifySuperAdmin(id, `Nouvelle info utile soumise par contributeur ${req.user.id}.`);
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[contributor/info POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const [rows] = await db.query(
      `SELECT * FROM useful_contacts WHERE id = ? AND created_by = ? AND status IN ('pending','rejected')`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Soumission introuvable ou non modifiable' });

    const allowed = ['category', 'phone', 'whatsapp', 'website', 'available_24h', 'display_order'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
    if (rows[0].status === 'rejected') fields.status = 'pending';

    if (Object.keys(fields).length) {
      await db.query('UPDATE useful_contacts SET ? WHERE id = ?', [fields, req.params.id]);
    }

    if (req.body.translations?.length) {
      for (const t of req.body.translations) {
        await db.query(
          `INSERT INTO useful_contact_translations (contact_id, locale, name, description, address)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), address=VALUES(address)`,
          [req.params.id, t.locale, t.name, t.description || null, t.address || null]
        );
      }
    }

    if (rows[0].status === 'rejected') {
      await notifySuperAdmin(req.params.id, `Info utile resoumise après correction par contributeur ${req.user.id}.`);
    }

    const [updated] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[contributor/info PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
