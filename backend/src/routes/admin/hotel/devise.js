// Hotel-admin — Configuration du convertisseur de devises
// GET  /api/admin/hotel/devise        → lire la config
// PUT  /api/admin/hotel/devise        → sauvegarder
// POST /api/admin/hotel/devise/refresh → forcer maj des taux
const express  = require('express');
const router   = express.Router();
const db       = require('../../../services/db');
const { refreshRates, getConfig } = require('../../../services/currencyService');

function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) {
    return parseInt(req.query.hotel_id);
  }
  return req.hotelId;
}

const VALID_CURRENCIES = [
  'XOF','XAF','EUR','USD','GBP','CHF','JPY','CNY','CAD','AUD',
  'MAD','GHS','NGN','ZAR','EGP','KES','TND','INR','BRL','AED',
  'RUB','SAR','MXN','SGD','HKD','NOK','SEK','DKK','PLN','CZK',
  'HUF','RON','TRY','IDR','MYR','THB','VND','PKR','BDT','ETB',
];

// GET /api/admin/hotel/devise
router.get('/', async (req, res) => {
  const hotelId = resolveHotelId(req);
  try {
    const cfg = await getConfig(hotelId);
    if (!cfg) {
      // Retourner config par défaut si inexistante
      return res.json({
        hotel_id:             hotelId,
        base_currency:        'XOF',
        target_currencies:    ['EUR', 'USD', 'GBP', 'CNY'],
        update_mode:          'auto',
        update_interval_hours: 6,
        daily_update_times:   null,
        rates:                null,
        last_update:          null,
        api_provider:         'open.er-api.com',
        api_key:              null,
        exists:               false,
      });
    }

    const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    res.json({
      ...cfg,
      target_currencies:   parse(cfg.target_currencies),
      display_currencies:  cfg.display_currencies ? parse(cfg.display_currencies) : null,
      rates:               cfg.rates ? parse(cfg.rates) : null,
      daily_update_times:  cfg.daily_update_times ? parse(cfg.daily_update_times) : null,
      exists: true,
    });
  } catch (e) {
    console.error('[GET /admin/hotel/devise]', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/hotel/devise
router.put('/', async (req, res) => {
  const hotelId = resolveHotelId(req);
  const {
    base_currency,
    target_currencies,
    display_currencies,
    update_mode,
    update_interval_hours,
    daily_update_times,
    api_provider,
    api_key,
  } = req.body;

  // Validation
  if (!base_currency || !VALID_CURRENCIES.includes(base_currency)) {
    return res.status(400).json({ error: 'Devise de base invalide' });
  }
  if (!Array.isArray(target_currencies) || target_currencies.length === 0 || target_currencies.length > 10) {
    return res.status(400).json({ error: 'Devises cibles : 1 à 10 requises' });
  }
  const invalidTargets = target_currencies.filter(c => !VALID_CURRENCIES.includes(c));
  if (invalidTargets.length) {
    return res.status(400).json({ error: `Devises inconnues : ${invalidTargets.join(', ')}` });
  }
  if (!['auto', 'manual'].includes(update_mode)) {
    return res.status(400).json({ error: 'Mode invalide (auto|manual)' });
  }
  const interval = parseInt(update_interval_hours) || 6;
  if (interval < 1 || interval > 24) {
    return res.status(400).json({ error: 'Intervalle entre 1 et 24 heures' });
  }

  // Validation display_currencies (sous-ensemble des cibles, max 5)
  let displayCurrencies = null;
  if (Array.isArray(display_currencies) && display_currencies.length > 0) {
    if (display_currencies.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 devises pour l\'affichage du tableau des taux' });
    }
    const invalidDisplay = display_currencies.filter(c => !target_currencies.includes(c) && c !== base_currency);
    if (invalidDisplay.length) {
      return res.status(400).json({ error: `Devises d'affichage non incluses dans les cibles : ${invalidDisplay.join(', ')}` });
    }
    displayCurrencies = display_currencies;
  }

  let dailyTimes = null;
  if (Array.isArray(daily_update_times) && daily_update_times.length > 0) {
    const timeRe = /^\d{2}:\d{2}$/;
    if (!daily_update_times.every(t => timeRe.test(t))) {
      return res.status(400).json({ error: 'Heures quotidiennes invalides (format HH:MM)' });
    }
    dailyTimes = daily_update_times;
  }

  try {
    const existing = await getConfig(hotelId);
    if (existing) {
      await db.query(
        `UPDATE devise_config
            SET base_currency         = ?,
                target_currencies     = ?,
                display_currencies    = ?,
                update_mode           = ?,
                update_interval_hours = ?,
                daily_update_times    = ?,
                api_provider          = ?,
                api_key               = ?
          WHERE hotel_id = ?`,
        [
          base_currency,
          JSON.stringify(target_currencies),
          displayCurrencies ? JSON.stringify(displayCurrencies) : null,
          update_mode,
          interval,
          dailyTimes ? JSON.stringify(dailyTimes) : null,
          api_provider || 'open.er-api.com',
          api_key || null,
          hotelId,
        ],
      );
    } else {
      await db.query(
        `INSERT INTO devise_config
           (hotel_id, base_currency, target_currencies, display_currencies,
            update_mode, update_interval_hours, daily_update_times, api_provider, api_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hotelId,
          base_currency,
          JSON.stringify(target_currencies),
          displayCurrencies ? JSON.stringify(displayCurrencies) : null,
          update_mode,
          interval,
          dailyTimes ? JSON.stringify(dailyTimes) : null,
          api_provider || 'open.er-api.com',
          api_key || null,
        ],
      );
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[PUT /admin/hotel/devise]', e.message);
    res.status(500).json({ error: 'Erreur sauvegarde' });
  }
});

// POST /api/admin/hotel/devise/refresh
router.post('/refresh', async (req, res) => {
  const hotelId = resolveHotelId(req);
  try {
    const result = await refreshRates(hotelId);
    res.json({ success: true, last_update: result.last_update, from: result.from });
  } catch (e) {
    console.error('[POST /admin/hotel/devise/refresh]', e.message);
    res.status(500).json({ error: 'Impossible de mettre à jour les taux : ' + e.message });
  }
});

module.exports = router;
