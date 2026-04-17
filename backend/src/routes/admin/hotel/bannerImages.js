// Hotel-admin — Galerie d'images de bannière
// GET    /api/admin/hotel/banner-images          → liste des images
// POST   /api/admin/hotel/banner-images          → upload (multiple, max 10 au total)
// DELETE /api/admin/hotel/banner-images/:id      → suppression
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../../../services/db');
const cache   = require('../../../services/cacheService');

const MAX_IMAGES = 10;
const UPLOAD_DIR = path.resolve(__dirname, '../../../../../uploads/hotels');

function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) {
    return parseInt(req.query.hotel_id);
  }
  return req.hotelId;
}

const IMAGE_SIGNATURES = [
  { ext: '.jpg',  bytes: [0xFF, 0xD8, 0xFF] },
  { ext: '.png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: '.gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
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

function saveImage(buffer, hotelId, suffix) {
  const ext = detectImageType(buffer);
  if (!ext) throw new Error('Format image non reconnu');
  const filename = `hotel_${hotelId}_banner_${suffix}${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/hotels/${filename}`;
}

async function invalidateKioskCache(hotelId) {
  try {
    const [[h]] = await db.query('SELECT slug FROM hotels WHERE id = ?', [hotelId]);
    if (h) await cache.del(`kiosk:config:${h.slug}`);
  } catch {}
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Fichier image requis'));
    cb(null, true);
  },
});

// GET / — liste des images
router.get('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    const [rows] = await db.query(
      'SELECT id, url, display_order FROM hotel_banner_images WHERE hotel_id = ? ORDER BY display_order ASC',
      [hotelId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[banner-images GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / — upload de nouvelles images
router.post('/', upload.array('images', MAX_IMAGES), async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    if (!req.files?.length) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM hotel_banner_images WHERE hotel_id = ?', [hotelId]
    );
    const available = MAX_IMAGES - count;
    if (available <= 0) return res.status(400).json({ error: `Limite de ${MAX_IMAGES} images atteinte` });

    const [[{ maxOrder }]] = await db.query(
      'SELECT COALESCE(MAX(display_order), -1) AS maxOrder FROM hotel_banner_images WHERE hotel_id = ?',
      [hotelId]
    );

    const files  = req.files.slice(0, available);
    const saved  = [];
    const ts     = Date.now();

    for (let i = 0; i < files.length; i++) {
      const url   = saveImage(files[i].buffer, hotelId, `${ts}_${i}`);
      const order = maxOrder + 1 + i;
      const [result] = await db.query(
        'INSERT INTO hotel_banner_images (hotel_id, url, display_order) VALUES (?, ?, ?)',
        [hotelId, url, order]
      );
      saved.push({ id: result.insertId, url, display_order: order });
    }

    await invalidateKioskCache(hotelId);
    res.json(saved);
  } catch (err) {
    console.error('[banner-images POST]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// DELETE /:id — suppression d'une image
router.delete('/:id', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

    const [[img]] = await db.query(
      'SELECT * FROM hotel_banner_images WHERE id = ? AND hotel_id = ?',
      [req.params.id, hotelId]
    );
    if (!img) return res.status(404).json({ error: 'Image introuvable' });

    // Suppression du fichier physique
    const filePath = path.resolve(__dirname, '../../../../../', img.url.replace(/^\//, ''));
    try { fs.unlinkSync(filePath); } catch {}

    await db.query('DELETE FROM hotel_banner_images WHERE id = ?', [img.id]);
    await invalidateKioskCache(hotelId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[banner-images DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
