// Hotel-admin — Services et bien-être
// GET    /api/admin/hotel/services
// POST   /api/admin/hotel/services
// PUT    /api/admin/hotel/services/:id
// DELETE /api/admin/hotel/services/:id
// POST   /api/admin/hotel/services/:id/image
// GET    /api/admin/hotel/services/categories
// POST   /api/admin/hotel/services/categories
// PUT    /api/admin/hotel/services/categories/:id
// DELETE /api/admin/hotel/services/categories/:id
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const db      = require('../../../services/db');

// ── Upload image service ──────────────────────────────
const IMAGE_SIGNATURES = [
  { ext: '.jpg',  bytes: [0xFF, 0xD8, 0xFF] },
  { ext: '.png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: '.webp', bytes: [0x52, 0x49, 0x46, 0x46], also: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 } },
];
function detectImageType(buffer) {
  for (const sig of IMAGE_SIGNATURES) {
    const slice = [...buffer.slice(sig.offset || 0, (sig.offset || 0) + sig.bytes.length)];
    if (sig.bytes.every((b, i) => slice[i] === b)) {
      if (sig.also) {
        const s2 = [...buffer.slice(sig.also.offset, sig.also.offset + sig.also.bytes.length)];
        if (!sig.also.bytes.every((b, i) => s2[i] === b)) continue;
      }
      return sig.ext;
    }
  }
  return null;
}
const uploadImg = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Fichier image requis'));
    cb(null, true);
  },
});
const SERVICES_IMG_DIR = path.resolve(__dirname, '../../../../../uploads/services');

function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) return parseInt(req.query.hotel_id);
  return req.hotelId;
}

// ── Catégories ────────────────────────────────────────────────────

// Catégories disponibles : globales + propres à l'hôtel
router.get('/categories', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      `SELECT * FROM service_categories
       WHERE hotel_id IS NULL OR hotel_id = ?
       ORDER BY hotel_id IS NULL DESC, display_order`,
      [hotelId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[hotel/services GET /categories]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une catégorie propre à l'hôtel
router.post('/categories', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const { label_fr, label_en, icon, display_order } = req.body;
    if (!label_fr) return res.status(400).json({ error: 'label_fr requis' });

    const [result] = await db.query(
      `INSERT INTO service_categories (hotel_id, label_fr, label_en, icon, display_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hotelId, label_fr, label_en || null, icon || '✨', display_order || 0, req.user.id]
    );
    const [rows] = await db.query('SELECT * FROM service_categories WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[hotel/services POST /categories]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une catégorie propre à l'hôtel
router.put('/categories/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM service_categories WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Catégorie introuvable ou non modifiable' });

    const { label_fr, label_en, icon, display_order, is_active } = req.body;
    const fields = {};
    if (label_fr      !== undefined) fields.label_fr      = label_fr;
    if (label_en      !== undefined) fields.label_en      = label_en;
    if (icon          !== undefined) fields.icon          = icon;
    if (display_order !== undefined) fields.display_order = display_order;
    if (is_active     !== undefined) fields.is_active     = is_active;

    await db.query('UPDATE service_categories SET ? WHERE id = ?', [fields, req.params.id]);
    const [updated] = await db.query('SELECT * FROM service_categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[hotel/services PUT /categories/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une catégorie propre à l'hôtel
router.delete('/categories/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query(
      'SELECT * FROM service_categories WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Catégorie introuvable ou non modifiable' });

    const [usage] = await db.query('SELECT COUNT(*) AS total FROM services WHERE category_id = ?', [req.params.id]);
    if (usage[0].total > 0) {
      return res.status(400).json({ error: `Catégorie utilisée par ${usage[0].total} service(s)` });
    }
    await db.query('DELETE FROM service_categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Catégorie supprimée' });
  } catch (err) {
    console.error('[hotel/services DELETE /categories/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Services ──────────────────────────────────────────────────────

// Lister les services de l'hôtel (avec toutes les traductions)
router.get('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

    const [rows] = await db.query(`
      SELECT s.*,
             sc.label_fr AS category_fr, sc.label_en AS category_en, sc.icon AS category_icon,
             JSON_OBJECTAGG(
               COALESCE(st.locale, '__none__'),
               JSON_OBJECT('name', st.name, 'description', st.description, 'benefits', st.benefits)
             ) AS translations
      FROM services s
      JOIN service_categories sc ON sc.id = s.category_id
      LEFT JOIN service_translations st ON st.service_id = s.id
      WHERE s.hotel_id = ?
      GROUP BY s.id
      ORDER BY sc.display_order, s.display_order
    `, [hotelId]);

    res.json(rows.map(r => {
      let tr = typeof r.translations === 'string' ? JSON.parse(r.translations) : r.translations;
      if (tr) delete tr['__none__'];
      return { ...r, translations: tr || {} };
    }));
  } catch (err) {
    console.error('[hotel/services GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un service
router.post('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

    const {
      category_id, slug, duration_min, price_fcfa, image_url, video_url,
      contact_phone, booking_info, available_hours, available_days,
      max_per_day, display_order, translations,
    } = req.body;
    if (!category_id || !slug) return res.status(400).json({ error: 'category_id et slug requis' });

    const [result] = await db.query(
      `INSERT INTO services
         (hotel_id, category_id, slug, duration_min, price_fcfa, image_url, video_url,
          contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [hotelId, category_id, slug, duration_min || null, price_fcfa || 0,
       image_url || null, video_url || null, contact_phone || null, booking_info || null,
       available_hours || null, available_days || null, max_per_day || 10, display_order || 0]
    );
    const id = result.insertId;

    if (translations?.length) {
      for (const t of translations) {
        await db.query(
          'INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES (?, ?, ?, ?, ?)',
          [id, t.locale, t.name, t.description || null, t.benefits || null]
        );
      }
    }

    const [rows] = await db.query('SELECT * FROM services WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce slug existe déjà pour cet hôtel' });
    console.error('[hotel/services POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un service
router.put('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query('SELECT * FROM services WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]);
    if (!rows[0]) return res.status(404).json({ error: 'Service introuvable' });

    const allowed = [
      'category_id', 'duration_min', 'price_fcfa', 'image_url', 'video_url',
      'contact_phone', 'booking_info', 'available_hours', 'available_days',
      'max_per_day', 'display_order', 'is_active',
    ];
    const fields = {};
    for (const k of allowed) if (req.body[k] !== undefined) fields[k] = req.body[k];

    if (Object.keys(fields).length) {
      await db.query('UPDATE services SET ? WHERE id = ?', [fields, req.params.id]);
    }

    if (req.body.translations?.length) {
      for (const t of req.body.translations) {
        await db.query(
          `INSERT INTO service_translations (service_id, locale, name, description, benefits)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), benefits=VALUES(benefits)`,
          [req.params.id, t.locale, t.name, t.description || null, t.benefits || null]
        );
      }
    }

    const [updated] = await db.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[hotel/services PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload image d'aperçu d'un service
router.post('/:id/image', uploadImg.single('image'), async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query('SELECT * FROM services WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]);
    if (!rows[0]) return res.status(404).json({ error: 'Service introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });

    const ext = detectImageType(req.file.buffer);
    if (!ext) return res.status(400).json({ error: 'Format image non reconnu' });

    fs.mkdirSync(SERVICES_IMG_DIR, { recursive: true });
    const filename = `service_${req.params.id}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(SERVICES_IMG_DIR, filename), req.file.buffer);
    const url = `/uploads/services/${filename}`;

    await db.query('UPDATE services SET image_url = ? WHERE id = ?', [url, req.params.id]);
    res.json({ url });
  } catch (err) {
    console.error('[hotel/services POST /:id/image]', err);
    res.status(500).json({ error: 'Erreur upload' });
  }
});

// Supprimer un service
router.delete('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    const [rows] = await db.query('SELECT * FROM services WHERE id = ? AND hotel_id = ?', [req.params.id, hotelId]);
    if (!rows[0]) return res.status(404).json({ error: 'Service introuvable' });
    await db.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ message: 'Service supprimé' });
  } catch (err) {
    console.error('[hotel/services DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
