// Super-admin — Gestion des hôtels
// GET    /api/admin/super/hotels
// POST   /api/admin/super/hotels
// PUT    /api/admin/super/hotels/:id
// DELETE /api/admin/super/hotels/:id
const express = require('express');
const router = express.Router();
const Hotel = require('../../../models/hotel');

// TODO: implémenter les handlers
router.get('/',       async (req, res) => res.json({ todo: 'list hotels' }));
router.post('/',      async (req, res) => res.json({ todo: 'create hotel' }));
router.put('/:id',    async (req, res) => res.json({ todo: 'update hotel' }));
router.delete('/:id', async (req, res) => res.json({ todo: 'delete hotel' }));

module.exports = router;
