// Hotel-admin — Agenda (événements propres à l'hôtel)
// GET    /api/admin/hotel/events
// POST   /api/admin/hotel/events       — publication immédiate, visible hôtel uniquement
// PUT    /api/admin/hotel/events/:id
// DELETE /api/admin/hotel/events/:id
// POST   /api/admin/hotel/events/:id/archive
// GET    /api/admin/hotel/events/pending  — soumissions staff en attente de pré-validation
// POST   /api/admin/hotel/events/:id/pre-approve
// POST   /api/admin/hotel/events/:id/reject
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/pending',            async (req, res) => res.json({ todo: 'list pending events for pre-approval' }));
router.get('/',                   async (req, res) => res.json({ todo: 'list hotel events' }));
router.post('/',                  async (req, res) => res.json({ todo: 'create hotel event (published immediately)' }));
router.put('/:id',                async (req, res) => res.json({ todo: 'update hotel event' }));
router.delete('/:id',             async (req, res) => res.json({ todo: 'delete hotel event' }));
router.post('/:id/archive',       async (req, res) => res.json({ todo: 'archive hotel event' }));
router.post('/:id/pre-approve',   async (req, res) => res.json({ todo: 'pre-approve contributor event' }));
router.post('/:id/reject',        async (req, res) => res.json({ todo: 'reject contributor event + motif' }));

module.exports = router;
