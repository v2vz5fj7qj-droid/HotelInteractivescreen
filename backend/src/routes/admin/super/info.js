// Super-admin — Infos utiles + workflow validation
// GET    /api/admin/super/info
// POST   /api/admin/super/info
// PUT    /api/admin/super/info/:id
// DELETE /api/admin/super/info/:id
// POST   /api/admin/super/info/:id/publish
// POST   /api/admin/super/info/:id/reject
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',              async (req, res) => res.json({ todo: 'list all useful info with status' }));
router.post('/',             async (req, res) => res.json({ todo: 'create useful info' }));
router.put('/:id',           async (req, res) => res.json({ todo: 'update useful info' }));
router.delete('/:id',        async (req, res) => res.json({ todo: 'delete useful info' }));
router.post('/:id/publish',  async (req, res) => res.json({ todo: 'publish useful info' }));
router.post('/:id/reject',   async (req, res) => res.json({ todo: 'reject useful info + motif' }));

module.exports = router;
