// Super-admin — Gestion agenda global + workflow validation
// GET    /api/admin/super/events
// POST   /api/admin/super/events
// PUT    /api/admin/super/events/:id
// DELETE /api/admin/super/events/:id
// POST   /api/admin/super/events/:id/publish
// POST   /api/admin/super/events/:id/reject
// POST   /api/admin/super/events/:id/archive
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',               async (req, res) => res.json({ todo: 'list all events with status' }));
router.post('/',              async (req, res) => res.json({ todo: 'create global event' }));
router.put('/:id',            async (req, res) => res.json({ todo: 'update any event' }));
router.delete('/:id',         async (req, res) => res.json({ todo: 'delete any event' }));
router.post('/:id/publish',   async (req, res) => res.json({ todo: 'publish event' }));
router.post('/:id/reject',    async (req, res) => res.json({ todo: 'reject event + motif' }));
router.post('/:id/archive',   async (req, res) => res.json({ todo: 'manual archive event' }));

module.exports = router;
