// Super-admin — Catégories globales de services
// GET    /api/admin/super/service-categories
// POST   /api/admin/super/service-categories
// PUT    /api/admin/super/service-categories/:id
// DELETE /api/admin/super/service-categories/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',       async (req, res) => res.json({ todo: 'list global service categories' }));
router.post('/',      async (req, res) => res.json({ todo: 'create global service category' }));
router.put('/:id',    async (req, res) => res.json({ todo: 'update global service category' }));
router.delete('/:id', async (req, res) => res.json({ todo: 'delete global service category' }));

module.exports = router;
