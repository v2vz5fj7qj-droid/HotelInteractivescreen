// Hotel-admin — Paramètres de l'hôtel (branding, contacts, thème)
// GET  /api/admin/hotel/settings
// PUT  /api/admin/hotel/settings
// POST /api/admin/hotel/settings/logo        — upload logo
// POST /api/admin/hotel/settings/background  — upload image de fond
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',              async (req, res) => res.json({ todo: 'get hotel settings' }));
router.put('/',              async (req, res) => res.json({ todo: 'update hotel settings' }));
router.post('/logo',         async (req, res) => res.json({ todo: 'upload logo' }));
router.post('/background',   async (req, res) => res.json({ todo: 'upload background image' }));

module.exports = router;
