// Super-admin — Gestion carte & lieux + workflow validation
// GET    /api/admin/super/places
// POST   /api/admin/super/places
// PUT    /api/admin/super/places/:id
// DELETE /api/admin/super/places/:id
// POST   /api/admin/super/places/:id/publish
// POST   /api/admin/super/places/:id/reject
// POST   /api/admin/super/places/:id/assign     — affecter à un hôtel
// DELETE /api/admin/super/places/:id/assign/:hotelId
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',                         async (req, res) => res.json({ todo: 'list all places with status' }));
router.post('/',                        async (req, res) => res.json({ todo: 'create place' }));
router.put('/:id',                      async (req, res) => res.json({ todo: 'update place' }));
router.delete('/:id',                   async (req, res) => res.json({ todo: 'delete place' }));
router.post('/:id/publish',             async (req, res) => res.json({ todo: 'publish place' }));
router.post('/:id/reject',              async (req, res) => res.json({ todo: 'reject place + motif' }));
router.post('/:id/assign',              async (req, res) => res.json({ todo: 'assign place to hotel' }));
router.delete('/:id/assign/:hotelId',   async (req, res) => res.json({ todo: 'remove place from hotel' }));

module.exports = router;
