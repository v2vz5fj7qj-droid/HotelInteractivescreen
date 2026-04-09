// Contributeur — Mes événements (can_submit_events requis)
// GET  /api/admin/contributor/events
// POST /api/admin/contributor/events
// PUT  /api/admin/contributor/events/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',     async (req, res) => res.json({ todo: 'list my submitted events' }));
router.post('/',    async (req, res) => res.json({ todo: 'submit event (status: pending)' }));
router.put('/:id',  async (req, res) => res.json({ todo: 'update my event (only if pending/rejected)' }));

module.exports = router;
