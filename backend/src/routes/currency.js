// Route publique kiosque — convertisseur de devises
// GET /api/currency/config?hotel_id=X          → config (base + cibles)
// GET /api/currency/convert?hotel_id=X&amount=N → équivalences
const express  = require('express');
const router   = express.Router();
const { convert, getRates, getConfig, refreshRates } = require('../services/currencyService');

// Validation montant
function parseAmount(raw) {
  const n = parseFloat(raw);
  if (isNaN(n) || n < 0 || n > 1_000_000_000) return null;
  return n;
}

// GET /api/currency/config
router.get('/config', async (req, res) => {
  const hotelId = parseInt(req.query.hotel_id);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id requis' });

  try {
    const cfg = await getConfig(hotelId);
    if (!cfg) return res.status(404).json({ error: 'Aucune configuration devise pour cet hôtel' });

    res.json({
      base_currency:     cfg.base_currency,
      target_currencies: typeof cfg.target_currencies === 'string'
        ? JSON.parse(cfg.target_currencies)
        : cfg.target_currencies,
      last_update: cfg.last_update,
    });
  } catch (e) {
    console.error('[GET /currency/config]', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/currency/convert?hotel_id=X&amount=N&base=XOF
router.get('/convert', async (req, res) => {
  const hotelId = parseInt(req.query.hotel_id);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id requis' });

  const amount = parseAmount(req.query.amount ?? '1');
  if (amount === null) return res.status(400).json({ error: 'Montant invalide (0–1 000 000 000)' });

  try {
    const result = await convert(hotelId, amount);
    if (!result) return res.status(404).json({ error: 'Aucune configuration devise pour cet hôtel' });
    res.json(result);
  } catch (e) {
    console.error('[GET /currency/convert]', e.message);
    res.status(500).json({ error: 'Impossible de récupérer les taux de change' });
  }
});

// GET /api/currency/rates — tableau des taux croisés pour l'écran d'accueil devise
// Retourne toutes les paires C(N,2) entre la devise de base et les display_currencies (max 5)
router.get('/rates', async (req, res) => {
  const hotelId = parseInt(req.query.hotel_id);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id requis' });

  try {
    const ratesResult = await getRates(hotelId);
    if (!ratesResult) return res.status(404).json({ error: 'Aucune configuration devise pour cet hôtel' });

    const cfg = await getConfig(hotelId);

    // Devises affichées : display_currencies (max 5) ou fallback sur les 5 premières cibles
    let displayRaw = cfg.display_currencies;
    if (typeof displayRaw === 'string') displayRaw = JSON.parse(displayRaw);
    let displayCurrencies = Array.isArray(displayRaw) && displayRaw.length > 0
      ? displayRaw.slice(0, 5)
      : (() => {
          const t = typeof cfg.target_currencies === 'string'
            ? JSON.parse(cfg.target_currencies)
            : cfg.target_currencies;
          return (t || []).slice(0, 5);
        })();

    // Ensemble complet : base + display
    const base = cfg.base_currency;
    const allCurrencies = [base, ...displayCurrencies.filter(c => c !== base)];
    const allRates = ratesResult.rates; // { EUR: 0.0015, USD: 0.0016, ... } relatif à base

    // Génère toutes les paires C(N,2)
    const pairs = [];
    for (let i = 0; i < allCurrencies.length; i++) {
      for (let j = i + 1; j < allCurrencies.length; j++) {
        const from = allCurrencies[i];
        const to   = allCurrencies[j];

        // Taux from→to : rate[to] / rate[from], avec rate[base] = 1
        const rateFrom = from === base ? 1 : (allRates[from] ?? null);
        const rateTo   = to   === base ? 1 : (allRates[to]   ?? null);

        if (rateFrom === null || rateTo === null) continue;

        pairs.push({
          from,
          to,
          rate: rateTo / rateFrom,   // 1 [from] = x [to]
        });
      }
    }

    res.json({
      base,
      currencies:  allCurrencies,
      pairs,
      last_update: ratesResult.last_update,
    });
  } catch (e) {
    console.error('[GET /currency/rates]', e.message);
    res.status(500).json({ error: 'Impossible de calculer les taux croisés' });
  }
});

// POST /api/currency/refresh  (kiosque — bouton actualiser)
// Limité par le rate-limiter global ; ne rafraîchit que si > 5 min depuis dernière maj
router.post('/refresh', async (req, res) => {
  const hotelId = parseInt(req.query.hotel_id || req.body?.hotel_id);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id requis' });

  try {
    const cfg = await getConfig(hotelId);
    if (!cfg) return res.status(404).json({ error: 'Aucune configuration devise' });

    // Anti-abus : pas plus d'un refresh toutes les 5 min depuis la borne
    if (cfg.last_update) {
      const ageMin = (Date.now() - new Date(cfg.last_update).getTime()) / 60_000;
      if (ageMin < 5) {
        return res.json({ success: true, skipped: true, last_update: cfg.last_update });
      }
    }

    const result = await refreshRates(hotelId, cfg);
    res.json({ success: true, last_update: result.last_update });
  } catch (e) {
    console.error('[POST /currency/refresh]', e.message);
    res.status(500).json({ error: 'Impossible de rafraîchir les taux' });
  }
});

module.exports = router;
