// Contributeur — Mes infos utiles (can_submit_info requis)
// GET  /api/admin/contributor/info
// POST /api/admin/contributor/info
// PUT  /api/admin/contributor/info/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',     async (req, res) => res.json({ todo: 'list my submitted info' }));
router.post('/',    async (req, res) => res.json({ todo: 'submit useful info (status: pending)' }));
router.put('/:id',  async (req, res) => res.json({ todo: 'update my info (only if pending/rejected)' }));

module.exports = router;
