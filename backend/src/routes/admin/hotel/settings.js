// Hotel-admin — Paramètres de l'hôtel (branding, contacts, thème)
// GET  /api/admin/hotel/settings
// PUT  /api/admin/hotel/settings
// POST /api/admin/hotel/settings/logo        — upload logo
// POST /api/admin/hotel/settings/background  — upload image de fond
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../../../services/db');

// Super-admin peut passer ?hotel_id=X pour gérer n'importe quel hôtel
function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) {
    return parseInt(req.query.hotel_id);
  }
  return req.hotelId;
}

// Vérifie les magic bytes pour s'assurer que c'est bien une image
const IMAGE_SIGNATURES = [
  { ext: '.jpg',  bytes: [0xFF, 0xD8, 0xFF] },
  { ext: '.png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: '.gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: '.webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, also: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 } },
  { ext: '.bmp',  bytes: [0x42, 0x4D] },
];

function detectImageType(buffer) {
  for (const sig of IMAGE_SIGNATURES) {
    const slice = [...buffer.slice(sig.offset || 0, (sig.offset || 0) + sig.bytes.length)];
    if (sig.bytes.every((b, i) => slice[i] === b)) {
      if (sig.also) {
        const slice2 = [...buffer.slice(sig.also.offset, sig.also.offset + sig.also.bytes.length)];
        if (!sig.also.bytes.every((b, i) => slice2[i] === b)) continue;
      }
      return sig.ext;
    }
  }
  return null;
}

// Upload en mémoire — validation magic bytes avant écriture disque
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Fichier image requis'));
    cb(null, true);
  },
});

const UPLOAD_DIR = path.resolve(__dirname, '../../../../../uploads/hotels');

function saveUploadedImage(buffer, hotelId, fieldname) {
  const ext = detectImageType(buffer);
  if (!ext) throw new Error('Format image non reconnu (magic bytes invalides)');
  const filename = `hotel_${hotelId}_${fieldname}${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/hotels/${filename}`;
}

// Lire les paramètres
router.get('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

    const [rows] = await db.query(
      'SELECT * FROM hotel_settings WHERE hotel_id = ?', [hotelId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Paramètres introuvables pour cet hôtel' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[hotel/settings GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier les paramètres
router.put('/', async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

    const allowed = [
      'nom', 'adresse', 'telephone', 'email_contact', 'lat', 'lng',
      'theme_colors', 'font_primary', 'font_secondary', 'font_file_url',
      'idle_timeout_ms', 'fullscreen_password',
      'welcome_message_fr', 'welcome_message_en', 'welcome_message_de',
      'welcome_message_es', 'welcome_message_pt', 'welcome_message_ar',
      'welcome_message_zh', 'welcome_message_ja', 'welcome_message_ru',
    ];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = key === 'theme_colors' && typeof req.body[key] === 'object'
          ? JSON.stringify(req.body[key])
          : req.body[key];
      }
    }
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    await db.query('UPDATE hotel_settings SET ? WHERE hotel_id = ?', [fields, hotelId]);
    const [rows] = await db.query('SELECT * FROM hotel_settings WHERE hotel_id = ?', [hotelId]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[hotel/settings PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload logo
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const url = saveUploadedImage(req.file.buffer, hotelId, 'logo');
    await db.query('UPDATE hotel_settings SET logo_url = ? WHERE hotel_id = ?', [url, hotelId]);
    res.json({ logo_url: url });
  } catch (err) {
    if (err.message.includes('magic bytes')) return res.status(400).json({ error: err.message });
    console.error('[hotel/settings POST /logo]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload police custom (.ttf / .otf / .woff / .woff2)
const FONT_UPLOAD_DIR = path.resolve(__dirname, '../../../../../uploads/fonts');
const ALLOWED_FONT_EXTS = ['.ttf', '.otf', '.woff', '.woff2'];

const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 Mo
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_FONT_EXTS.includes(ext)) {
      return cb(new Error('Format non supporté (.ttf, .otf, .woff, .woff2 uniquement)'));
    }
    cb(null, true);
  },
});

router.post('/font', fontUpload.single('font'), async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });
    if (!req.file)  return res.status(400).json({ error: 'Fichier manquant' });

    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filename = `hotel_${hotelId}_font${ext}`;
    fs.mkdirSync(FONT_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(FONT_UPLOAD_DIR, filename), req.file.buffer);
    const url = `/uploads/fonts/${filename}`;
    await db.query('UPDATE hotel_settings SET font_file_url = ? WHERE hotel_id = ?', [url, hotelId]);
    res.json({ font_file_url: url });
  } catch (err) {
    console.error('[hotel/settings POST /font]', err);
    res.status(err.message.includes('Format') ? 400 : 500).json({ error: err.message });
  }
});

// Upload image de fond
router.post('/background', upload.single('background'), async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const url = saveUploadedImage(req.file.buffer, hotelId, 'background');
    await db.query('UPDATE hotel_settings SET background_url = ? WHERE hotel_id = ?', [url, hotelId]);
    res.json({ background_url: url });
  } catch (err) {
    if (err.message.includes('magic bytes')) return res.status(400).json({ error: err.message });
    console.error('[hotel/settings POST /background]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
