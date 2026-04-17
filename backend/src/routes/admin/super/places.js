// Super-admin — Gestion carte & lieux + workflow validation
// GET    /api/admin/super/places
// GET    /api/admin/super/places/:id
// POST   /api/admin/super/places
// PUT    /api/admin/super/places/:id
// DELETE /api/admin/super/places/:id
// POST   /api/admin/super/places/:id/publish
// POST   /api/admin/super/places/:id/reject
// PUT    /api/admin/super/places/:id/hotels    — remplace toutes les affectations (bulk)
// POST   /api/admin/super/places/:id/assign
// DELETE /api/admin/super/places/:id/assign/:hotelId
// POST   /api/admin/super/places/:id/images   — upload image (max 3)
// DELETE /api/admin/super/places/images/:imageId
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const router  = express.Router();
const db      = require('../../../services/db');

const poiImgDir = path.resolve(__dirname, '../../../../../uploads/poi');
if (!fs.existsSync(poiImgDir)) fs.mkdirSync(poiImgDir, { recursive: true });

const uploadPoiImg = multer({
  storage: multer.diskStorage({
    destination: poiImgDir,
    filename: (req, file, cb) => cb(null, `poi_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté (JPG, PNG, WebP)'));
  },
});

async function notifyAuthor(userId, type, entityId, messageFr) {
  if (!userId) return;
  await db.query(
    `INSERT INTO workflow_notifications (recipient_id, type, entity_type, entity_id, message_fr)
     VALUES (?, ?, 'place', ?, ?)`,
    [userId, type, entityId, messageFr]
  );
}

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'place', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

// Lister tous les lieux avec statut et hôtels associés (avec pagination + recherche)
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.min(100, parseInt(req.query.per_page) || 25);
    const offset   = (page - 1) * per_page;

    const conditions = [];
    const params = [];
    if (status) { conditions.push('p.status = ?'); params.push(status); }
    if (search) { conditions.push('(COALESCE(pt_fr.name, pt_en.name) LIKE ? OR p.category LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total FROM points_of_interest p
       LEFT JOIN poi_translations pt_fr ON pt_fr.poi_id = p.id AND pt_fr.locale = 'fr'
       LEFT JOIN poi_translations pt_en ON pt_en.poi_id = p.id AND pt_en.locale = 'en'
       ${where}`,
      params
    );

    const [places] = await db.query(`
      SELECT p.*,
             COALESCE(pt_fr.name,    pt_en.name)    AS name,
             COALESCE(pt_fr.address, pt_en.address) AS address,
             u.email AS created_by_email
      FROM points_of_interest p
      LEFT JOIN poi_translations pt_fr ON pt_fr.poi_id = p.id AND pt_fr.locale = 'fr'
      LEFT JOIN poi_translations pt_en ON pt_en.poi_id = p.id AND pt_en.locale = 'en'
      LEFT JOIN admin_users u ON u.id = p.created_by
      ${where}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, per_page, offset]);

    const [assignments] = await db.query(`
      SELECT hp.place_id, hp.hotel_id, h.nom AS hotel_nom
      FROM hotel_places hp JOIN hotels h ON h.id = hp.hotel_id
    `);

    const hotelMap = {};
    for (const a of assignments) {
      if (!hotelMap[a.place_id]) hotelMap[a.place_id] = [];
      hotelMap[a.place_id].push({ hotel_id: a.hotel_id, nom: a.hotel_nom });
    }

    const data = places.map(p => ({ ...p, hotels: hotelMap[p.id] || [] }));
    res.json({ data, total, page, per_page, total_pages: Math.ceil(total / per_page) });
  } catch (err) {
    console.error('[super/places GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un lieu avec ses traductions et images
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });
    const [translations] = await db.query('SELECT * FROM poi_translations WHERE poi_id = ?', [req.params.id]);
    const [images] = await db.query('SELECT * FROM poi_images WHERE poi_id = ? ORDER BY display_order', [req.params.id]);
    const [hotels] = await db.query(`
      SELECT hp.hotel_id, h.nom FROM hotel_places hp
      JOIN hotels h ON h.id = hp.hotel_id WHERE hp.place_id = ?
    `, [req.params.id]);
    res.json({ ...rows[0], translations, images, hotels });
  } catch (err) {
    console.error('[super/places GET/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un lieu (super-admin → publié directement)
router.post('/', async (req, res) => {
  try {
    const { category, lat, lng, phone, website, rating, price_level, display_order, translations } = req.body;
    if (!category || !lat || !lng) return res.status(400).json({ error: 'category, lat, lng requis' });

    const [result] = await db.query(
      `INSERT INTO points_of_interest
         (category, lat, lng, phone, website, rating, price_level, display_order,
          created_by, status, validated_by, validated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, NOW())`,
      [category, lat, lng, phone || null, website || null, rating || null,
       price_level || null, display_order || 0, req.user.id, req.user.id]
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

    await auditLog(req.user.id, 'create', id, null, { category, lat, lng });
    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[super/places POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un lieu
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Lieu introuvable' });

    const allowed = ['category', 'lat', 'lng', 'phone', 'website', 'rating', 'price_level', 'display_order', 'is_active'];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

    if (Object.keys(fields).length) {
      await db.query('UPDATE points_of_interest SET ? WHERE id = ?', [fields, req.params.id]);
    }

    // Mettre à jour les traductions si fournies
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

    await auditLog(req.user.id, 'update', req.params.id, existing[0], fields);
    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/places PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un lieu
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });
    await db.query('DELETE FROM points_of_interest WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'delete', req.params.id, rows[0], null);
    res.json({ message: 'Lieu supprimé' });
  } catch (err) {
    console.error('[super/places DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Publier un lieu (soumission contributeur)
router.post('/:id/publish', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });
    if (rows[0].status === 'published') return res.status(400).json({ error: 'Déjà publié' });

    await db.query(
      `UPDATE points_of_interest
       SET status='published', validated_by=?, validated_at=NOW(), rejection_reason=NULL
       WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await auditLog(req.user.id, 'publish', req.params.id, { status: rows[0].status }, { status: 'published' });
    await notifyAuthor(rows[0].created_by, 'published', req.params.id, 'Votre lieu a été publié.');
    res.json({ message: 'Lieu publié' });
  } catch (err) {
    console.error('[super/places POST /publish]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejeter un lieu
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Motif de rejet requis' });

    const [rows] = await db.query('SELECT * FROM points_of_interest WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });

    await db.query(
      `UPDATE points_of_interest
       SET status='rejected', validated_by=?, validated_at=NOW(), rejection_reason=?
       WHERE id=?`,
      [req.user.id, reason, req.params.id]
    );
    await auditLog(req.user.id, 'reject', req.params.id, { status: rows[0].status }, { status: 'rejected', reason });
    await notifyAuthor(rows[0].created_by, 'rejected', req.params.id, `Votre lieu a été rejeté : ${reason}`);
    res.json({ message: 'Lieu rejeté' });
  } catch (err) {
    console.error('[super/places POST /reject]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Remplacer toutes les affectations hôtels d'un lieu (bulk)
router.put('/:id/hotels', async (req, res) => {
  try {
    const { hotel_ids } = req.body;
    if (!Array.isArray(hotel_ids)) return res.status(400).json({ error: 'hotel_ids (array) requis' });
    const [rows] = await db.query('SELECT id FROM points_of_interest WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });

    await db.query('DELETE FROM hotel_places WHERE place_id = ?', [req.params.id]);
    for (const hid of hotel_ids) {
      await db.query('INSERT IGNORE INTO hotel_places (hotel_id, place_id) VALUES (?, ?)', [hid, req.params.id]);
    }
    await auditLog(req.user.id, 'assign_hotels', req.params.id, null, { hotel_ids });
    const [hotels] = await db.query(
      `SELECT hp.hotel_id, h.nom FROM hotel_places hp
       JOIN hotels h ON h.id = hp.hotel_id WHERE hp.place_id = ?`,
      [req.params.id]
    );
    res.json({ hotels });
  } catch (err) {
    console.error('[super/places PUT /:id/hotels]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Affecter un lieu à un hôtel
router.post('/:id/assign', async (req, res) => {
  try {
    const { hotel_id, display_order = 0 } = req.body;
    if (!hotel_id) return res.status(400).json({ error: 'hotel_id requis' });
    await db.query(
      'INSERT IGNORE INTO hotel_places (hotel_id, place_id, display_order) VALUES (?, ?, ?)',
      [hotel_id, req.params.id, display_order]
    );
    res.json({ message: 'Lieu affecté à l\'hôtel' });
  } catch (err) {
    console.error('[super/places POST /assign]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer un lieu d'un hôtel
router.delete('/:id/assign/:hotelId', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM hotel_places WHERE place_id = ? AND hotel_id = ?',
      [req.params.id, req.params.hotelId]
    );
    res.json({ message: 'Lieu retiré de l\'hôtel' });
  } catch (err) {
    console.error('[super/places DELETE /assign]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/super/places/:id/images — upload image (max 3 par lieu)
router.post('/:id/images', uploadPoiImg.single('image'), async (req, res) => {
  try {
    const poiId = req.params.id;
    const [rows] = await db.query('SELECT id FROM points_of_interest WHERE id = ?', [poiId]);
    if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });

    const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM poi_images WHERE poi_id = ?', [poiId]);
    if (count >= 3) {
      if (req.file) fs.unlink(path.join(poiImgDir, req.file.filename), () => {});
      return res.status(400).json({ error: 'Maximum 3 images par lieu' });
    }

    const url = `/uploads/poi/${req.file.filename}`;
    const [result] = await db.query(
      'INSERT INTO poi_images (poi_id, url, display_order) VALUES (?, ?, ?)',
      [poiId, url, count]
    );
    res.status(201).json({ id: result.insertId, url });
  } catch (err) {
    console.error('[super/places POST /:id/images]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// DELETE /api/admin/super/places/images/:imageId
router.delete('/images/:imageId', async (req, res) => {
  try {
    const [[img]] = await db.query('SELECT * FROM poi_images WHERE id = ?', [req.params.imageId]);
    if (!img) return res.status(404).json({ error: 'Image introuvable' });

    const filePath = path.join(poiImgDir, path.basename(img.url));
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});

    await db.query('DELETE FROM poi_images WHERE id = ?', [req.params.imageId]);
    res.json({ message: 'Image supprimée' });
  } catch (err) {
    console.error('[super/places DELETE /images/:imageId]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
