const express = require('express');
const db      = require('../services/db');
const cache   = require('../services/cacheService');
const router  = express.Router();

// GET /api/theme  → Retourne toute la config thème
router.get('/', async (req, res) => {
  const cacheKey = 'theme:config';
  const cached   = await cache.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    const [rows] = await db.query('SELECT config_key, config_value, label FROM theme_config');
    const config = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
    const meta   = Object.fromEntries(rows.map(r => [r.config_key, { value: r.config_value, label: r.label }]));

    const payload = { config, meta };
    await cache.set(cacheKey, JSON.stringify(payload), 300); // 5 min
    res.json(payload);
  } catch (err) {
    console.error('[Theme]', err.message);
    // Thème par défaut en fallback
    res.json({ config: getDefaultTheme(), meta: {} });
  }
});

// PUT /api/theme  → Met à jour une ou plusieurs valeurs de thème
// Body: { updates: { "color_primary": "#FF0000", ... } }
router.put('/', async (req, res) => {
  const { updates } = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Body invalide. Attendu: { updates: { key: value } }' });
  }

  const allowedKeys = [
    'hotel_name','color_primary','color_primary_dark','color_secondary',
    'color_bg_dark','color_bg_light','color_surface_dark','color_surface_light',
    'color_text_dark','color_text_light','color_accent',
    'font_primary','font_secondary','logo_url','logo_url_dark','idle_timeout_ms',
    'fullscreen_password',
  ];

  const invalidKeys = Object.keys(updates).filter(k => !allowedKeys.includes(k));
  if (invalidKeys.length) {
    return res.status(400).json({ error: `Clés invalides: ${invalidKeys.join(', ')}` });
  }

  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        'UPDATE theme_config SET config_value = ? WHERE config_key = ?',
        [String(value), key]
      );
    }
    await cache.del('theme:config'); // Invalider le cache
    res.json({ success: true, updated: Object.keys(updates) });
  } catch (err) {
    console.error('[Theme PUT]', err.message);
    res.status(500).json({ error: 'Erreur mise à jour thème' });
  }
});

function getDefaultTheme() {
  return {
    hotel_name:         'ConnectBé',
    color_primary:      '#C2782A',
    color_primary_dark: '#8B4F12',
    color_secondary:    '#D4A843',
    color_bg_dark:      '#1A1208',
    color_bg_light:     '#FDF6EC',
    color_surface_dark: '#2C1E0A',
    color_surface_light:'#FFFFFF',
    color_text_dark:    '#F5E6C8',
    color_text_light:   '#2C1A06',
    color_accent:       '#E8521A',
    font_primary:       'Poppins',
    font_secondary:     'Playfair Display',
    logo_url:           '/images/logo.png',
    logo_url_dark:      '/images/logo-dark.png',
    idle_timeout_ms:    '30000',
  };
}

// POST /api/theme/fullscreen-verify  → Vérifie le mot de passe plein écran (public)
router.post('/fullscreen-verify', async (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string') return res.json({ ok: false });
  try {
    const [rows] = await db.query(
      "SELECT config_value FROM theme_config WHERE config_key = 'fullscreen_password'"
    );
    const stored = rows[0]?.config_value || 'fs1234';
    res.json({ ok: password === stored });
  } catch {
    res.json({ ok: password === 'fs1234' });
  }
});

module.exports = router;
