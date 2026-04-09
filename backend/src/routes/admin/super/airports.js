// Super-admin — Gestion des aéroports et planification
// GET    /api/admin/super/airports
// POST   /api/admin/super/airports
// PUT    /api/admin/super/airports/:code
// DELETE /api/admin/super/airports/:code
// POST   /api/admin/super/airports/:code/refresh   — rafraîchissement forcé
// POST   /api/admin/super/airports/:code/assign    — affecter à un hôtel
// DELETE /api/admin/super/airports/:code/assign/:hotelId
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',                           async (req, res) => res.json({ todo: 'list airports' }));
router.post('/',                          async (req, res) => res.json({ todo: 'create airport' }));
router.put('/:code',                      async (req, res) => res.json({ todo: 'update airport + regen cron_expression' }));
router.delete('/:code',                   async (req, res) => res.json({ todo: 'delete airport' }));
router.post('/:code/refresh',             async (req, res) => res.json({ todo: 'force refresh flights for airport' }));
router.post('/:code/assign',              async (req, res) => res.json({ todo: 'assign airport to hotel' }));
router.delete('/:code/assign/:hotelId',   async (req, res) => res.json({ todo: 'remove airport from hotel' }));

module.exports = router;
