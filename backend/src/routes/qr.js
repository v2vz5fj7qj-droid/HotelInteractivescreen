const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const db      = require('../services/db');

const TTL_MIN = parseInt(process.env.QR_TOKEN_TTL_MIN || '10', 10);
const VALID_SECTIONS = ['weather', 'flights', 'map', 'wellness', 'info'];

// POST /api/qr/token — génère un token signé avec TTL
router.post('/token', async (req, res) => {
  const { section = 'weather', locale = 'fr' } = req.body;

  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'Section invalide' });
  }

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);

  try {
    await db.query(
      'INSERT INTO qr_tokens (token, section, locale, expires_at) VALUES (?, ?, ?, ?)',
      [token, section, locale, expiresAt]
    );

    // Nettoyage opportuniste des tokens expirés (sans bloquer la réponse)
    db.query('DELETE FROM qr_tokens WHERE expires_at < NOW()').catch(() => {});

    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      ttlMin: TTL_MIN,
    });
  } catch (err) {
    console.error('[QR token]', err.message);
    res.status(500).json({ error: 'Erreur génération token' });
  }
});

// GET /api/qr/validate/:token — vérifie la validité d'un token
router.get('/validate/:token', async (req, res) => {
  const { token } = req.params;

  // UUID basique : 36 caractères
  if (!token || token.length !== 36) {
    return res.status(400).json({ valid: false, reason: 'Format invalide' });
  }

  try {
    const [rows] = await db.query(
      'SELECT section, locale, expires_at FROM qr_tokens WHERE token = ?',
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ valid: false, reason: 'Token inconnu' });
    }

    const { section, locale, expires_at } = rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(410).json({ valid: false, reason: 'Token expiré' });
    }

    res.json({ valid: true, section, locale });
  } catch (err) {
    console.error('[QR validate]', err.message);
    res.status(500).json({ error: 'Erreur validation token' });
  }
});

module.exports = router;
