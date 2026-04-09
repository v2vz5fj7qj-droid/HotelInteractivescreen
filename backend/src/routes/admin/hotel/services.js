// Hotel-admin — Services et bien-être
// GET    /api/admin/hotel/services
// POST   /api/admin/hotel/services
// PUT    /api/admin/hotel/services/:id
// DELETE /api/admin/hotel/services/:id
// GET    /api/admin/hotel/services/categories       — catégories dispo (globales + propres)
// POST   /api/admin/hotel/services/categories       — créer catégorie propre à l'hôtel
// PUT    /api/admin/hotel/services/categories/:id
// DELETE /api/admin/hotel/services/categories/:id
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/categories',       async (req, res) => res.json({ todo: 'list categories (global + hotel)' }));
router.post('/categories',      async (req, res) => res.json({ todo: 'create hotel category' }));
router.put('/categories/:id',   async (req, res) => res.json({ todo: 'update hotel category' }));
router.delete('/categories/:id',async (req, res) => res.json({ todo: 'delete hotel category' }));
router.get('/',                 async (req, res) => res.json({ todo: 'list hotel services' }));
router.post('/',                async (req, res) => res.json({ todo: 'create service' }));
router.put('/:id',              async (req, res) => res.json({ todo: 'update service' }));
router.delete('/:id',           async (req, res) => res.json({ todo: 'delete service' }));

module.exports = router;
