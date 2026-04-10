// Contributeur — Mes événements (can_submit_events requis)
// GET  /api/admin/contributor/events
// POST /api/admin/contributor/events
// PUT  /api/admin/contributor/events/:id
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

function checkPermission(req, res) {
  if (!req.user.can_submit_events) {
    res.status(403).json({ error: 'Permission can_submit_events non accordée' });
    return false;
  }
  return true;
}

async function notifySuperAdmin(entityId, messageFr) {
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     SELECT id, 'submission_pending', 'event', ?, ?
     FROM admin_users WHERE role = 'super_admin' AND is_active = 1`,
    [entityId, messageFr]
  );
}

router.get('/', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const [rows] = await db.query(
      `SELECT e.*, et.title
       FROM events e
       LEFT JOIN event_translations et ON et.event_id = e.id AND et.locale = 'fr'
       WHERE e.created_by = ?
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[contributor/events GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const {
      slug, category, start_date, end_date, start_time, end_time,
      location, lat, lng, price_fcfa, image_url, is_recurrent, recurrence_rule, translations,
    } = req.body;
    if (!slug || !category || !start_date) return res.status(400).json({ error: 'slug, category et start_date requis' });

    const [result] = await db.query(
      `INSERT INTO events
         (slug, category, start_date, end_date, start_time, end_time, location, lat, lng,
          price_fcfa, image_url, is_recurrent, recurrence_rule, auto_archive,
          created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [slug, category, start_date, end_date || null, start_time || null, end_time || null,
       location || null, lat || null, lng || null, price_fcfa || 0, image_url || null,
       is_recurrent || 0, recurrence_rule || null, end_date && !is_recurrent ? 1 : 0,
       req.user.id]
    );
    const id = result.insertId;

    if (translations?.length) {
      for (const t of translations) {
        await db.query(
          'INSERT INTO event_translations (event_id, locale, title, description, tags) VALUES (?, ?, ?, ?, ?)',
          [id, t.locale, t.title, t.description || null, t.tags || null]
        );
      }
    }

    await notifySuperAdmin(id, `Nouvel événement soumis par contributeur ${req.user.id}.`);
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce slug existe déjà' });
    console.error('[contributor/events POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!checkPermission(req, res)) return;
    const [rows] = await db.query(
      `SELECT * FROM events WHERE id = ? AND created_by = ? AND status IN ('pending','rejected')`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Soumission introuvable ou non modifiable' });

    const allowed = ['category', 'start_date', 'end_date', 'start_time', 'end_time',
                     'location', 'lat', 'lng', 'price_fcfa', 'image_url', 'is_recurrent', 'recurrence_rule'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];
    if (rows[0].status === 'rejected') fields.status = 'pending';

    if (Object.keys(fields).length) {
      await db.query('UPDATE events SET ? WHERE id = ?', [fields, req.params.id]);
    }

    if (req.body.translations?.length) {
      for (const t of req.body.translations) {
        await db.query(
          `INSERT INTO event_translations (event_id, locale, title, description, tags)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), tags=VALUES(tags)`,
          [req.params.id, t.locale, t.title, t.description || null, t.tags || null]
        );
      }
    }

    if (rows[0].status === 'rejected') {
      await notifySuperAdmin(req.params.id, `Événement resoumis après correction par contributeur ${req.user.id}.`);
    }

    const [updated] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[contributor/events PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
