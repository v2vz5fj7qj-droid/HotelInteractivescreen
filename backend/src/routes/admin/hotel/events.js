// Hotel-admin — Agenda (événements propres à l'hôtel + pré-validation staff/contributeurs)
// GET    /api/admin/hotel/events
// GET    /api/admin/hotel/events/pending
// POST   /api/admin/hotel/events           — publié immédiatement, visible hôtel uniquement
// PUT    /api/admin/hotel/events/:id
// DELETE /api/admin/hotel/events/:id
// POST   /api/admin/hotel/events/:id/archive
// POST   /api/admin/hotel/events/:id/pre-approve
// POST   /api/admin/hotel/events/:id/reject
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) return parseInt(req.query.hotel_id);
  return req.hotelId;
}

async function notifyAuthor(userId, type, entityId, messageFr) {
  if (!userId) return;
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     VALUES (?, ?, 'event', ?, ?)`,
    [userId, type, entityId, messageFr]
  );
}

// Soumissions en attente de pré-validation (staff + contributeurs liés à cet hôtel)
router.get('/pending', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(`
      SELECT e.*, et.title, u.email AS created_by_email
      FROM events e
      LEFT JOIN event_translations et ON et.event_id = e.id AND et.locale = 'fr'
      LEFT JOIN admin_users u ON u.id = e.created_by
      WHERE e.hotel_id = ? AND e.status IN ('pending')
      ORDER BY e.created_at ASC
    `, [hotelId]);
    res.json(rows);
  } catch (err) {
    console.error('[hotel/events GET /pending]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les événements de l'hôtel
router.get('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const [rows] = await db.query(`
      SELECT e.*, et.title, et.description, u.email AS created_by_email
      FROM events e
      LEFT JOIN event_translations et ON et.event_id = e.id AND et.locale = 'fr'
      LEFT JOIN admin_users u ON u.id = e.created_by
      WHERE e.hotel_id = ?
      ORDER BY e.start_date DESC
    `, [hotelId]);
    res.json(rows);
  } catch (err) {
    console.error('[hotel/events GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un événement hôtel (publié immédiatement, sans validation)
router.post('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

    const {
      slug, category, start_date, end_date, start_time, end_time,
      location, lat, lng, price_fcfa, image_url, is_featured,
      is_recurrent, recurrence_rule, translations,
    } = req.body;
    if (!slug || !category || !start_date) return res.status(400).json({ error: 'slug, category et start_date requis' });

    const auto_archive = end_date && !is_recurrent ? 1 : 0;

    const [result] = await db.query(
      `INSERT INTO events
         (slug, category, start_date, end_date, start_time, end_time, location, lat, lng,
          price_fcfa, image_url, is_featured, is_recurrent, recurrence_rule, auto_archive,
          hotel_id, created_by, status, validated_by, validated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, NOW())`,
      [slug, category, start_date, end_date || null, start_time || null, end_time || null,
       location || null, lat || null, lng || null, price_fcfa || 0, image_url || null,
       is_featured || 0, is_recurrent || 0, recurrence_rule || null, auto_archive,
       hotelId, req.user.id, req.user.id]
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

    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce slug existe déjà' });
    console.error('[hotel/events POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un événement de l'hôtel
router.put('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM events WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });

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

    const [updated] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[hotel/events PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un événement de l'hôtel
router.delete('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT id FROM events WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Événement supprimé' });
  } catch (err) {
    console.error('[hotel/events DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Archiver manuellement
router.post('/:id/archive', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT id FROM events WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    await db.query('UPDATE events SET status="archived", archived_at=NOW() WHERE id=?', [req.params.id]);
    res.json({ message: 'Événement archivé' });
  } catch (err) {
    console.error('[hotel/events POST /archive]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Pré-valider une soumission (staff/contributeur → pre_approved)
router.post('/:id/pre-approve', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM events WHERE id = ? AND hotel_id = ? AND status = "pending"', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Soumission introuvable ou déjà traitée' });

    await db.query(
      'UPDATE events SET status="pre_approved" WHERE id=?', [req.params.id]
    );
    // Notifier le super-admin (user id=1 par convention — à adapter si plusieurs super-admins)
    await db.query(
      `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
       SELECT id, 'pre_approved', 'event', ?, 'Un événement a été pré-validé et attend votre validation finale.'
       FROM admin_users WHERE role = 'super_admin' AND is_active = 1`,
      [req.params.id]
    );
    await notifyAuthor(rows[0].created_by, 'pre_approved', req.params.id, 'Votre événement a été pré-validé, en attente de validation finale.');
    res.json({ message: 'Événement pré-validé' });
  } catch (err) {
    console.error('[hotel/events POST /pre-approve]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejeter une soumission
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Motif de rejet requis' });
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM events WHERE id = ? AND hotel_id = ? AND status IN ("pending","pre_approved")',
      [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Soumission introuvable' });

    await db.query(
      'UPDATE events SET status="rejected", rejection_reason=?, validated_by=?, validated_at=NOW() WHERE id=?',
      [reason, req.user.id, req.params.id]
    );
    await notifyAuthor(rows[0].created_by, 'rejected', req.params.id, `Votre événement a été rejeté : ${reason}`);
    res.json({ message: 'Événement rejeté' });
  } catch (err) {
    console.error('[hotel/events POST /reject]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
