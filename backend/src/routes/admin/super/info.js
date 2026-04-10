// Super-admin — Infos utiles + workflow validation
// GET    /api/admin/super/info
// GET    /api/admin/super/info/:id
// POST   /api/admin/super/info
// PUT    /api/admin/super/info/:id
// DELETE /api/admin/super/info/:id
// POST   /api/admin/super/info/:id/publish
// POST   /api/admin/super/info/:id/reject
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

async function notifyAuthor(userId, type, entityId, messageFr) {
  if (!userId) return;
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     VALUES (?, ?, 'useful_info', ?, ?)`,
    [userId, type, entityId, messageFr]
  );
}

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'useful_info', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

// Lister toutes les infos utiles
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? 'WHERE u.status = ?' : '';
    const params = status ? [status] : [];

    const [rows] = await db.query(`
      SELECT u.*, uct.name, uct.description, uct.address,
             au.email AS created_by_email
      FROM useful_contacts u
      LEFT JOIN useful_contact_translations uct ON uct.contact_id = u.id AND uct.locale = 'fr'
      LEFT JOIN admin_users au ON au.id = u.created_by
      ${where}
      ORDER BY u.display_order, u.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('[super/info GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail avec traductions
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Info introuvable' });
    const [translations] = await db.query('SELECT * FROM useful_contact_translations WHERE contact_id = ?', [req.params.id]);
    res.json({ ...rows[0], translations });
  } catch (err) {
    console.error('[super/info GET/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une info utile (publiée directement par le super-admin)
router.post('/', async (req, res) => {
  try {
    const { category, phone, whatsapp, website, available_24h, display_order, translations } = req.body;
    if (!category) return res.status(400).json({ error: 'category requis' });

    const [result] = await db.query(
      `INSERT INTO useful_contacts
         (category, phone, whatsapp, website, available_24h, display_order,
          created_by, status, validated_by, validated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, NOW())`,
      [category, phone || null, whatsapp || null, website || null,
       available_24h || 0, display_order || 0, req.user.id, req.user.id]
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

    await auditLog(req.user.id, 'create', id, null, { category });
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[super/info POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une info utile
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Info introuvable' });

    const allowed = ['category', 'phone', 'whatsapp', 'website', 'available_24h', 'display_order', 'is_active'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

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

    await auditLog(req.user.id, 'update', req.params.id, existing[0], fields);
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/info PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une info utile
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Info introuvable' });
    await db.query('DELETE FROM useful_contacts WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'delete', req.params.id, rows[0], null);
    res.json({ message: 'Info supprimée' });
  } catch (err) {
    console.error('[super/info DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Publier
router.post('/:id/publish', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Info introuvable' });
    if (rows[0].status === 'published') return res.status(400).json({ error: 'Déjà publié' });

    await db.query(
      `UPDATE useful_contacts SET status='published', validated_by=?, validated_at=NOW(), rejection_reason=NULL WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await auditLog(req.user.id, 'publish', req.params.id, { status: rows[0].status }, { status: 'published' });
    await notifyAuthor(rows[0].created_by, 'published', req.params.id, 'Votre info a été publiée.');
    res.json({ message: 'Info publiée' });
  } catch (err) {
    console.error('[super/info POST /publish]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejeter
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Motif de rejet requis' });
    const [rows] = await db.query('SELECT * FROM useful_contacts WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Info introuvable' });

    await db.query(
      `UPDATE useful_contacts SET status='rejected', validated_by=?, validated_at=NOW(), rejection_reason=? WHERE id=?`,
      [req.user.id, reason, req.params.id]
    );
    await auditLog(req.user.id, 'reject', req.params.id, { status: rows[0].status }, { status: 'rejected', reason });
    await notifyAuthor(rows[0].created_by, 'rejected', req.params.id, `Votre info a été rejetée : ${reason}`);
    res.json({ message: 'Info rejetée' });
  } catch (err) {
    console.error('[super/info POST /reject]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
