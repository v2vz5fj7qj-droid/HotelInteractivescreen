// Super-admin — Suivi consommation tokens FlightAPI
// GET  /api/admin/super/tokens
// PUT  /api/admin/super/tokens        — mettre à jour quota + seuil d'alerte
// POST /api/admin/super/tokens/reset  — remettre used_tokens à 0 (nouveau cycle)
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

const SERVICE = 'flightapi';

async function getTracking() {
  const [rows] = await db.query(
    'SELECT * FROM api_token_tracking WHERE service = ?', [SERVICE]
  );
  if (!rows[0]) return null;
  const t = rows[0];
  return {
    ...t,
    remaining:        t.total_tokens - t.used_tokens,
    usage_percent:    t.total_tokens > 0
      ? Math.round((t.used_tokens / t.total_tokens) * 100)
      : 0,
    alert_triggered:  (t.total_tokens - t.used_tokens) <= t.alert_threshold,
  };
}

// Lire le suivi
router.get('/', async (req, res) => {
  try {
    const data = await getTracking();
    if (!data) return res.status(404).json({ error: 'Suivi introuvable' });
    res.json(data);
  } catch (err) {
    console.error('[super/tokens GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour quota total et/ou seuil d'alerte
router.put('/', async (req, res) => {
  try {
    const { total_tokens, alert_threshold } = req.body;
    const fields = {};
    if (total_tokens    !== undefined) fields.total_tokens    = parseInt(total_tokens);
    if (alert_threshold !== undefined) fields.alert_threshold = parseInt(alert_threshold);

    if (!Object.keys(fields).length) return res.status(400).json({ error: 'total_tokens ou alert_threshold requis' });

    await db.query(
      'UPDATE api_token_tracking SET ? WHERE service = ?',
      [fields, SERVICE]
    );
    res.json(await getTracking());
  } catch (err) {
    console.error('[super/tokens PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Remettre le compteur à zéro (nouveau cycle de quota)
router.post('/reset', async (req, res) => {
  try {
    await db.query(
      'UPDATE api_token_tracking SET used_tokens = 0 WHERE service = ?',
      [SERVICE]
    );
    res.json(await getTracking());
  } catch (err) {
    console.error('[super/tokens POST /reset]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
