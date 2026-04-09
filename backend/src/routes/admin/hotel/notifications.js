// Hotel-admin — Notifications rotatives de la borne
// GET    /api/admin/hotel/notifications
// POST   /api/admin/hotel/notifications
// PUT    /api/admin/hotel/notifications/:id
// DELETE /api/admin/hotel/notifications/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/',       async (req, res) => res.json({ todo: 'list hotel notifications' }));
router.post('/',      async (req, res) => res.json({ todo: 'create notification' }));
router.put('/:id',    async (req, res) => res.json({ todo: 'update notification' }));
router.delete('/:id', async (req, res) => res.json({ todo: 'delete notification' }));

module.exports = router;
