// Routes publiques kiosque — configuration par hôtel
// GET /api/kiosk/:slug/config  → thème + settings de l'hôtel
// GET /api/hotels/public       → liste des hôtels actifs (pour page d'accueil)
const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/kiosk/:slug/config
// Retourne tout ce dont le kiosque a besoin au démarrage
router.get('/:slug/config', async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `kiosk:config:${slug}`;

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(
      `SELECT
         h.id, h.slug, h.nom AS hotel_nom,
         hs.nom, hs.logo_url, hs.logo_url_dark, hs.background_url,
         hs.theme_colors, hs.font_primary, hs.font_secondary,
         hs.adresse, hs.telephone, hs.email_contact,
         hs.lat, hs.lng,
         hs.idle_timeout_ms, hs.fullscreen_password,
         hs.wifi_name, hs.wifi_password,
         hs.checkin_time, hs.checkout_time
       FROM hotels h
       JOIN hotel_settings hs ON hs.hotel_id = h.id
       WHERE h.slug = ? AND h.is_active = 1
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Hôtel introuvable', slug });
    }

    const row = rows[0];
    const payload = {
      hotel: { id: row.id, slug: row.slug, nom: row.hotel_nom },
      settings: {
        nom:                row.nom,
        logo_url:           row.logo_url,
        logo_url_dark:      row.logo_url_dark,
        background_url:     row.background_url,
        theme_colors:       typeof row.theme_colors === 'string'
                              ? JSON.parse(row.theme_colors)
                              : row.theme_colors,
        font_primary:       row.font_primary,
        font_secondary:     row.font_secondary,
        adresse:            row.adresse,
        telephone:          row.telephone,
        email_contact:      row.email_contact,
        lat:                row.lat,
        lng:                row.lng,
        idle_timeout_ms:    row.idle_timeout_ms ?? 30000,
        fullscreen_password: row.fullscreen_password ?? 'fs1234',
        wifi_name:          row.wifi_name ?? null,
        wifi_password:      row.wifi_password ?? null,
        checkin_time:       row.checkin_time ?? null,
        checkout_time:      row.checkout_time ?? null,
      },
    };

    await cache.set(cacheKey, JSON.stringify(payload), 300); // 5 min
    res.json(payload);
  } catch (err) {
    console.error('[kiosk/config]', err.message);
    res.status(500).json({ error: 'Erreur chargement configuration hôtel' });
  }
});

// GET /api/hotels/public
// Liste des hôtels actifs pour la page d'accueil (données non sensibles)
router.get('/hotels/public', async (_req, res) => {
  const cacheKey = 'hotels:public';
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const [rows] = await db.query(
      `SELECT h.id, h.slug, h.nom, hs.logo_url, hs.adresse
       FROM hotels h
       JOIN hotel_settings hs ON hs.hotel_id = h.id
       WHERE h.is_active = 1
       ORDER BY h.id ASC`
    );

    await cache.set(cacheKey, JSON.stringify(rows), 120); // 2 min
    res.json(rows);
  } catch (err) {
    console.error('[hotels/public]', err.message);
    res.status(500).json({ error: 'Erreur chargement liste hôtels' });
  }
});

module.exports = router;
