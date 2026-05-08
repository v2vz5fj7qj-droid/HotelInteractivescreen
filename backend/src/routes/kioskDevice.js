// Routes publiques borne kiosque — identification et monitoring
// POST /api/kiosk-device/register  — inscription avec clé usage unique
// POST /api/kiosk-device/auth      — authentification silencieuse au démarrage
// PUT  /api/kiosk-device/heartbeat — signal de vie toutes les 5 min
const express = require('express');
const crypto  = require('crypto');
const db      = require('../services/db');

const router  = express.Router();

// Génère un token de dispositif aléatoire (96 hex chars)
function generateDeviceToken() {
  return crypto.randomBytes(48).toString('hex');
}

// Extrait et valide le device_token depuis l'en-tête Authorization
function extractDeviceToken(req) {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

// POST /api/kiosk-device/register
// Body: { key, fingerprint, label? }
// Valide la clé usage unique et crée l'entrée borne
router.post('/register', async (req, res) => {
  const { key, fingerprint, label, hotel_slug } = req.body;

  if (!key) return res.status(400).json({ error: 'Clé d\'inscription requise' });

  try {
    // Vérifier la clé
    const [[keyRow]] = await db.query(
      `SELECT kk.id, kk.hotel_id, kk.used_at, kk.expires_at, h.slug AS hotel_slug
       FROM kiosk_keys kk
       JOIN hotels h ON h.id = kk.hotel_id
       WHERE kk.key_value = ?
       LIMIT 1`,
      [key.trim()]
    );

    const invalid =
      !keyRow ||
      keyRow.used_at ||
      new Date(keyRow.expires_at) < new Date() ||
      (hotel_slug && keyRow.hotel_slug !== hotel_slug);

    if (invalid) return res.status(400).json({ error: 'Clé invalide' });

    const deviceToken = generateDeviceToken();
    const now = new Date();

    // Créer la borne
    const [result] = await db.query(
      `INSERT INTO kiosks (hotel_id, label, device_token, fingerprint, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
      [keyRow.hotel_id, label || null, deviceToken, fingerprint || null, now]
    );

    const kioskId = result.insertId;

    // Marquer la clé comme utilisée
    await db.query(
      `UPDATE kiosk_keys SET used_at = ?, kiosk_id = ? WHERE id = ?`,
      [now, kioskId, keyRow.id]
    );

    return res.status(201).json({
      device_token: deviceToken,
      kiosk_id:    kioskId,
      hotel_slug:  keyRow.hotel_slug,
    });
  } catch (err) {
    console.error('[kiosk-device/register]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/kiosk-device/auth
// Body: { device_token }
// Vérifie le token et retourne l'état de la borne
router.post('/auth', async (req, res) => {
  const { device_token } = req.body;

  if (!device_token) return res.status(400).json({ error: 'Token requis' });

  try {
    const [[kiosk]] = await db.query(
      `SELECT k.id, k.hotel_id, k.is_enabled, h.slug AS hotel_slug
       FROM kiosks k
       JOIN hotels h ON h.id = k.hotel_id
       WHERE k.device_token = ?
       LIMIT 1`,
      [device_token]
    );

    if (!kiosk) return res.status(401).json({ error: 'Token invalide' });

    // Mettre à jour le dernier contact
    await db.query(
      'UPDATE kiosks SET last_seen_at = NOW() WHERE id = ?',
      [kiosk.id]
    );

    return res.json({
      kiosk_id:   kiosk.id,
      hotel_id:   kiosk.hotel_id,
      hotel_slug: kiosk.hotel_slug,
      enabled:    !!kiosk.is_enabled,
    });
  } catch (err) {
    console.error('[kiosk-device/auth]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/kiosk-device/heartbeat
// Header: Authorization: Bearer <device_token>
// Retourne l'état enabled en temps réel
router.put('/heartbeat', async (req, res) => {
  const token = extractDeviceToken(req);
  if (!token) return res.status(401).json({ error: 'Token requis' });

  try {
    const [[kiosk]] = await db.query(
      `SELECT id, is_enabled FROM kiosks WHERE device_token = ? LIMIT 1`,
      [token]
    );

    if (!kiosk) return res.status(401).json({ error: 'Token invalide' });

    await db.query(
      'UPDATE kiosks SET last_seen_at = NOW(), offline_notified_at = NULL WHERE id = ?',
      [kiosk.id]
    );

    return res.json({ enabled: !!kiosk.is_enabled });
  } catch (err) {
    console.error('[kiosk-device/heartbeat]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
