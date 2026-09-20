// Route QR Code — lien mobile vers le kiosque
// POST /api/qr/token          → génère un token signé (TTL configurable via QR_TOKEN_TTL_MIN)
// GET  /api/qr/validate/:token → valide le token et retourne l'hôtel + la section + locale cibles
// Le token est stocké en base et utilisé par MobileGate pour rediriger le téléphone
// vers la bonne section de la borne (météo, vols, carte, bien-être, infos).
// Le hotel_id est porté par le token : le téléphone n'a aucun contexte hôtel
// (pas de HotelProvider dans l'URL /mobile/:section), c'est la validation qui le lui donne.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const db      = require('../services/db');

const TTL_MIN = parseInt(process.env.QR_TOKEN_TTL_MIN || '10', 10);
const VALID_SECTIONS = ['weather', 'flights', 'map', 'wellness', 'info'];

// POST /api/qr/token — génère un token signé avec TTL
router.post('/token', async (req, res) => {
  const { section = 'weather', locale = 'fr' } = req.body;
  const hotelId = parseInt(req.body.hotel_id, 10);

  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'Section invalide' });
  }

  if (!Number.isInteger(hotelId)) {
    return res.status(400).json({ error: 'hotel_id requis' });
  }

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);

  try {
    await db.query(
      'INSERT INTO qr_tokens (token, hotel_id, section, locale, expires_at) VALUES (?, ?, ?, ?, ?)',
      [token, hotelId, section, locale, expiresAt]
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
      `SELECT q.section, q.locale, q.expires_at, q.hotel_id, h.slug AS hotel_slug
         FROM qr_tokens q
         LEFT JOIN hotels h ON h.id = q.hotel_id
        WHERE q.token = ?`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ valid: false, reason: 'Token inconnu' });
    }

    const { section, locale, expires_at, hotel_id, hotel_slug } = rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(410).json({ valid: false, reason: 'Token expiré' });
    }

    // L'hôtel a été supprimé depuis la génération du token
    if (!hotel_slug) {
      return res.status(404).json({ valid: false, reason: 'Hôtel introuvable' });
    }

    res.json({ valid: true, section, locale, hotel_id, hotel_slug });
  } catch (err) {
    console.error('[QR validate]', err.message);
    res.status(500).json({ error: 'Erreur validation token' });
  }
});

module.exports = router;
