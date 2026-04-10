// Super-admin — Gestion agenda global + workflow validation
// GET    /api/admin/super/events
// GET    /api/admin/super/events/:id
// POST   /api/admin/super/events
// PUT    /api/admin/super/events/:id
// DELETE /api/admin/super/events/:id
// POST   /api/admin/super/events/:id/publish
// POST   /api/admin/super/events/:id/reject
// POST   /api/admin/super/events/:id/archive
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

async function notifyAuthor(userId, type, entityId, messageFr) {
  if (!userId) return;
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     VALUES (?, ?, 'event', ?, ?)`,
    [userId, type, entityId, messageFr]
  );
}

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'event', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

// Lister tous les événements
router.get('/', async (req, res) => {
  try {
    const { status, hotel_id } = req.query;
    const conditions = [];
    const params = [];
    if (status)   { conditions.push('e.status = ?');   params.push(status); }
    if (hotel_id) { conditions.push('e.hotel_id = ?'); params.push(hotel_id); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await db.query(`
      SELECT e.*, et.title, et.description,
             u.email AS created_by_email, h.nom AS hotel_nom
      FROM events e
      LEFT JOIN event_translations et ON et.event_id = e.id AND et.locale = 'fr'
      LEFT JOIN admin_users u ON u.id = e.created_by
      LEFT JOIN hotels h ON h.id = e.hotel_id
      ${where}
      ORDER BY e.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('[super/events GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un événement avec ses traductions
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    const [translations] = await db.query('SELECT * FROM event_translations WHERE event_id = ?', [req.params.id]);
    res.json({ ...rows[0], translations });
  } catch (err) {
    console.error('[super/events GET/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un événement global (publié directement)
router.post('/', async (req, res) => {
  try {
    const {
      slug, category, start_date, end_date, start_time, end_time,
      location, lat, lng, price_fcfa, image_url, is_featured,
      is_recurrent, recurrence_rule, translations,
    } = req.body;
    if (!slug || !category || !start_date) {
      return res.status(400).json({ error: 'slug, category et start_date requis' });
    }

    const auto_archive = end_date ? 1 : 0;

    const [result] = await db.query(
      `INSERT INTO events
         (slug, category, start_date, end_date, start_time, end_time, location, lat, lng,
          price_fcfa, image_url, is_featured, is_recurrent, recurrence_rule, auto_archive,
          hotel_id, created_by, status, validated_by, validated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'published', ?, NOW())`,
      [slug, category, start_date, end_date || null, start_time || null, end_time || null,
       location || null, lat || null, lng || null, price_fcfa || 0, image_url || null,
       is_featured || 0, is_recurrent || 0, recurrence_rule || null, auto_archive,
       req.user.id, req.user.id]
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

    await auditLog(req.user.id, 'create', id, null, { slug, category, start_date });
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce slug existe déjà' });
    console.error('[super/events POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un événement (y compris ceux des hôtels et contributeurs)
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Événement introuvable' });

    const allowed = [
      'category', 'start_date', 'end_date', 'start_time', 'end_time',
      'location', 'lat', 'lng', 'price_fcfa', 'image_url', 'is_featured',
      'is_active', 'is_recurrent', 'recurrence_rule',
    ];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

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

    await auditLog(req.user.id, 'update', req.params.id, existing[0], fields);
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/events PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un événement
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'delete', req.params.id, rows[0], null);
    res.json({ message: 'Événement supprimé' });
  } catch (err) {
    console.error('[super/events DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Publier un événement
router.post('/:id/publish', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    if (rows[0].status === 'published') return res.status(400).json({ error: 'Déjà publié' });

    await db.query(
      `UPDATE events SET status='published', validated_by=?, validated_at=NOW(), rejection_reason=NULL WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await auditLog(req.user.id, 'publish', req.params.id, { status: rows[0].status }, { status: 'published' });
    await notifyAuthor(rows[0].created_by, 'published', req.params.id, 'Votre événement a été publié.');
    res.json({ message: 'Événement publié' });
  } catch (err) {
    console.error('[super/events POST /publish]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejeter un événement
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Motif de rejet requis' });
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });

    await db.query(
      `UPDATE events SET status='rejected', validated_by=?, validated_at=NOW(), rejection_reason=? WHERE id=?`,
      [req.user.id, reason, req.params.id]
    );
    await auditLog(req.user.id, 'reject', req.params.id, { status: rows[0].status }, { status: 'rejected', reason });
    await notifyAuthor(rows[0].created_by, 'rejected', req.params.id, `Votre événement a été rejeté : ${reason}`);
    res.json({ message: 'Événement rejeté' });
  } catch (err) {
    console.error('[super/events POST /reject]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Archiver manuellement un événement
router.post('/:id/archive', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    await db.query(
      `UPDATE events SET status='archived', archived_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    await auditLog(req.user.id, 'archive', req.params.id, { status: rows[0].status }, { status: 'archived' });
    res.json({ message: 'Événement archivé' });
  } catch (err) {
    console.error('[super/events POST /archive]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
