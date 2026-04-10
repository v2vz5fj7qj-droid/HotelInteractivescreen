// Hotel-admin — Paramètres de l'hôtel (branding, contacts, thème)
// GET  /api/admin/hotel/settings
// PUT  /api/admin/hotel/settings
// POST /api/admin/hotel/settings/logo        — upload logo
// POST /api/admin/hotel/settings/background  — upload image de fond
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const db      = require('../../../services/db');

// Super-admin peut passer ?hotel_id=X pour gérer n'importe quel hôtel
function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) {
    return parseInt(req.query.hotel_id);
  }
  return req.hotelId;
}

// Upload images hôtel
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../../../../uploads/hotels'),
  filename: (req, file, cb) => {
    const hotelId = resolveHotelId(req);
    const ext = path.extname(file.originalname);
    const field = file.fieldname; // 'logo' ou 'background'
    cb(null, `hotel_${hotelId}_${field}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Fichier image requis'));
    cb(null, true);
  },
});

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
      'theme_colors', 'font_primary', 'font_secondary',
      'idle_timeout_ms', 'fullscreen_password',
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
    const url = `/uploads/hotels/${req.file.filename}`;
    await db.query('UPDATE hotel_settings SET logo_url = ? WHERE hotel_id = ?', [url, hotelId]);
    res.json({ logo_url: url });
  } catch (err) {
    console.error('[hotel/settings POST /logo]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload image de fond
router.post('/background', upload.single('background'), async (req, res) => {
  try {
    const hotelId = resolveHotelId(req);
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const url = `/uploads/hotels/${req.file.filename}`;
    await db.query('UPDATE hotel_settings SET background_url = ? WHERE hotel_id = ?', [url, hotelId]);
    res.json({ background_url: url });
  } catch (err) {
    console.error('[hotel/settings POST /background]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
