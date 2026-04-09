// Super-admin — Suivi consommation tokens FlightAPI
// GET  /api/admin/super/tokens
// PUT  /api/admin/super/tokens        — mettre à jour quota + seuil d'alerte
// POST /api/admin/super/tokens/reset  — remettre used_tokens à 0
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',         async (req, res) => res.json({ todo: 'get token tracking' }));
router.put('/',         async (req, res) => res.json({ todo: 'update total_tokens + alert_threshold' }));
router.post('/reset',   async (req, res) => res.json({ todo: 'reset used_tokens to 0' }));

module.exports = router;
