// Super-admin — Gestion météo : localités par hôtel
// GET    /api/admin/super/weather/localities          — toutes les localités disponibles
// GET    /api/admin/super/weather/hotels/:hotelId     — localités d'un hôtel
// POST   /api/admin/super/weather/hotels/:hotelId     — ajouter une localité à un hôtel (max 5)
// DELETE /api/admin/super/weather/hotels/:hotelId/:localityId
// PUT    /api/admin/super/weather/hotels/:hotelId/:localityId/default — définir localité par défaut
// POST   /api/admin/super/weather/refresh/:localityId — rafraîchissement forcé
const express = require('express');
const router = express.Router();

// TODO: implémenter les handlers
router.get('/localities',                               async (req, res) => res.json({ todo: 'list all localities' }));
router.get('/hotels/:hotelId',                         async (req, res) => res.json({ todo: 'get hotel localities' }));
router.post('/hotels/:hotelId',                        async (req, res) => res.json({ todo: 'add locality to hotel (max 5)' }));
router.delete('/hotels/:hotelId/:localityId',          async (req, res) => res.json({ todo: 'remove locality from hotel' }));
router.put('/hotels/:hotelId/:localityId/default',     async (req, res) => res.json({ todo: 'set default locality' }));
router.post('/refresh/:localityId',                    async (req, res) => res.json({ todo: 'force weather refresh for locality' }));

module.exports = router;
