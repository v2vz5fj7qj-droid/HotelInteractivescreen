// Contributeur — Mes lieux (can_submit_places requis)
// GET  /api/admin/contributor/places       — mes soumissions
// POST /api/admin/contributor/places       — soumettre un lieu (status: pending)
// PUT  /api/admin/contributor/places/:id   — modifier (uniquement les siens, si pending/rejected)
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',     async (req, res) => res.json({ todo: 'list my submitted places' }));
router.post('/',    async (req, res) => res.json({ todo: 'submit place (status: pending)' }));
router.put('/:id',  async (req, res) => res.json({ todo: 'update my place (only if pending/rejected)' }));

module.exports = router;
