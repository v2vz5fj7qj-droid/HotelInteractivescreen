// Hotel-admin — Bon à savoir
// GET    /api/admin/hotel/tips
// POST   /api/admin/hotel/tips
// PUT    /api/admin/hotel/tips/:id
// DELETE /api/admin/hotel/tips/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',       async (req, res) => res.json({ todo: 'list hotel tips' }));
router.post('/',      async (req, res) => res.json({ todo: 'create tip' }));
router.put('/:id',    async (req, res) => res.json({ todo: 'update tip' }));
router.delete('/:id', async (req, res) => res.json({ todo: 'delete tip' }));

module.exports = router;
