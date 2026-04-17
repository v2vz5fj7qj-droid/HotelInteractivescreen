// Super-admin — Gestion agenda global + workflow validation
// GET    /api/admin/super/events
// GET    /api/admin/super/events/:id
// POST   /api/admin/super/events
// PUT    /api/admin/super/events/:id
// PUT    /api/admin/super/events/:id/hotels   — remplace toutes les affectations hôtels
// DELETE /api/admin/super/events/:id
// POST   /api/admin/super/events/:id/publish
// POST   /api/admin/super/events/:id/reject
// POST   /api/admin/super/events/:id/archive
// POST   /api/admin/super/events/:id/unarchive
// POST   /api/admin/super/events/:id/image    — upload image illustration
// DELETE /api/admin/super/events/:id/image    — supprimer image
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const router  = express.Router();
const db      = require('../../../services/db');

const eventImgDir = path.resolve(__dirname, '../../../../../uploads/events');
if (!fs.existsSync(eventImgDir)) fs.mkdirSync(eventImgDir, { recursive: true });

const uploadEventImg = multer({
  storage: multer.diskStorage({
    destination: eventImgDir,
    filename: (req, file, cb) => cb(null, `event_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté (JPG, PNG, WebP)'));
  },
});

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

// Lister tous les événements (avec pagination + recherche)
router.get('/', async (req, res) => {
  try {
    const { status, hotel_id, search } = req.query;
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.min(100, parseInt(req.query.per_page) || 25);
    const offset   = (page - 1) * per_page;

    const conditions = [];
    const params = [];
    if (status)   { conditions.push('e.status = ?');          params.push(status); }
    if (hotel_id) { conditions.push('he.hotel_id = ?');       params.push(hotel_id); }
    if (search)   { conditions.push('(COALESCE(et_fr.title, et_en.title) LIKE ? OR e.category LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT e.id) AS total FROM events e
       LEFT JOIN event_translations et_fr ON et_fr.event_id = e.id AND et_fr.locale = 'fr'
       LEFT JOIN event_translations et_en ON et_en.event_id = e.id AND et_en.locale = 'en'
       LEFT JOIN hotel_events he ON he.event_id = e.id
       ${where}`,
      params
    );

    const [rows] = await db.query(`
      SELECT e.*,
             COALESCE(et_fr.title,       et_en.title)       AS title,
             COALESCE(et_fr.description, et_en.description) AS description,
             u.email AS created_by_email,
             GROUP_CONCAT(DISTINCT h.nom ORDER BY h.nom SEPARATOR ', ') AS hotel_noms
      FROM events e
      LEFT JOIN event_translations et_fr ON et_fr.event_id = e.id AND et_fr.locale = 'fr'
      LEFT JOIN event_translations et_en ON et_en.event_id = e.id AND et_en.locale = 'en'
      LEFT JOIN admin_users u ON u.id = e.created_by
      LEFT JOIN hotel_events he ON he.event_id = e.id
      LEFT JOIN hotels h ON h.id = he.hotel_id
      ${where}
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, per_page, offset]);

    res.json({ data: rows, total, page, per_page, total_pages: Math.ceil(total / per_page) });
  } catch (err) {
    console.error('[super/events GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un événement avec ses traductions et hôtels associés
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    const [translations] = await db.query('SELECT * FROM event_translations WHERE event_id = ?', [req.params.id]);
    const [hotels] = await db.query(
      `SELECT he.hotel_id, h.nom FROM hotel_events he
       JOIN hotels h ON h.id = he.hotel_id WHERE he.event_id = ?`,
      [req.params.id]
    );
    res.json({ ...rows[0], translations, hotels });
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
          owner_hotel_id, created_by, status, validated_by, validated_at)
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

    // Affecter aux hôtels sélectionnés
    const hotel_ids = req.body.hotel_ids;
    if (Array.isArray(hotel_ids) && hotel_ids.length) {
      for (const hid of hotel_ids) {
        await db.query('INSERT IGNORE INTO hotel_events (hotel_id, event_id) VALUES (?, ?)', [hid, id]);
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

// Remplacer toutes les affectations hôtels d'un événement
router.put('/:id/hotels', async (req, res) => {
  try {
    const { hotel_ids } = req.body;
    if (!Array.isArray(hotel_ids)) return res.status(400).json({ error: 'hotel_ids (array) requis' });
    const [rows] = await db.query('SELECT id FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });

    await db.query('DELETE FROM hotel_events WHERE event_id = ?', [req.params.id]);
    for (const hid of hotel_ids) {
      await db.query('INSERT IGNORE INTO hotel_events (hotel_id, event_id) VALUES (?, ?)', [hid, req.params.id]);
    }
    await auditLog(req.user.id, 'assign_hotels', req.params.id, null, { hotel_ids });
    const [hotels] = await db.query(
      `SELECT he.hotel_id, h.nom FROM hotel_events he
       JOIN hotels h ON h.id = he.hotel_id WHERE he.event_id = ?`,
      [req.params.id]
    );
    res.json({ hotels });
  } catch (err) {
    console.error('[super/events PUT /:id/hotels]', err);
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

// Désarchiver manuellement un événement
router.post('/:id/unarchive', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    if (rows[0].status !== 'archived') {
      return res.status(400).json({ error: "L'événement n'est pas archivé" });
    }

    // Vérifier que la date de référence n'est pas passée
    const refDate = rows[0].end_date || rows[0].start_date;
    const [[{ today }]] = await db.query('SELECT CURDATE() AS today');
    if (refDate && new Date(refDate) < new Date(today)) {
      return res.status(422).json({
        code: 'date_passed',
        error: "La date de l'événement est passée. Mettez à jour la date avant de désarchiver.",
      });
    }

    await db.query(
      `UPDATE events SET status='published', archived_at=NULL WHERE id=?`,
      [req.params.id]
    );
    await auditLog(req.user.id, 'unarchive', req.params.id, { status: 'archived' }, { status: 'published' });
    await notifyAuthor(rows[0].created_by, 'unarchived', req.params.id, 'Votre événement a été réactivé et est à nouveau visible sur la borne.');
    res.json({ message: 'Événement désarchivé' });
  } catch (err) {
    console.error('[super/events POST /unarchive]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload image illustration d'un événement
router.post('/:id/image', uploadEventImg.single('image'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

    // Supprimer l'ancienne image locale si elle existe
    const old = rows[0].image_url;
    if (old && old.startsWith('/uploads/events/')) {
      const oldPath = path.resolve(__dirname, '../../../../../', old.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const image_url = `/uploads/events/${req.file.filename}`;
    await db.query('UPDATE events SET image_url = ? WHERE id = ?', [image_url, req.params.id]);
    await auditLog(req.user.id, 'upload_image', req.params.id, { image_url: old }, { image_url });
    res.json({ image_url });
  } catch (err) {
    console.error('[super/events POST /:id/image]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// Supprimer l'image d'un événement
router.delete('/:id/image', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT image_url FROM events WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable' });

    const old = rows[0].image_url;
    if (old && old.startsWith('/uploads/events/')) {
      const oldPath = path.resolve(__dirname, '../../../../../', old.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await db.query('UPDATE events SET image_url = NULL WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'delete_image', req.params.id, { image_url: old }, null);
    res.json({ message: 'Image supprimée' });
  } catch (err) {
    console.error('[super/events DELETE /:id/image]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
