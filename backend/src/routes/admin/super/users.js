// Super-admin — Gestion des utilisateurs admin
// GET    /api/admin/super/users
// POST   /api/admin/super/users
// PUT    /api/admin/super/users/:id
// DELETE /api/admin/super/users/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',       async (req, res) => res.json({ todo: 'list users' }));
router.post('/',      async (req, res) => res.json({ todo: 'create user' }));
router.put('/:id',    async (req, res) => res.json({ todo: 'update user' }));
router.delete('/:id', async (req, res) => res.json({ todo: 'deactivate user' }));

module.exports = router;
