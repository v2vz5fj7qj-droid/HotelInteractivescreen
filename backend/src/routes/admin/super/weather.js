// Super-admin — Gestion météo : localités par hôtel (max 5) + cache partagé
// GET    /api/admin/super/weather/localities
// GET    /api/admin/super/weather/hotels/:hotelId
// POST   /api/admin/super/weather/hotels/:hotelId
// DELETE /api/admin/super/weather/hotels/:hotelId/:localityId
// PUT    /api/admin/super/weather/hotels/:hotelId/:localityId/default
// POST   /api/admin/super/weather/refresh/:localityId
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

// Toutes les localités disponibles (référentiel global)
router.get('/localities', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM localities WHERE is_active = 1 ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('[super/weather GET /localities]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Localités affectées à un hôtel
router.get('/hotels/:hotelId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT hwl.id, hwl.hotel_id, hwl.locality_id, hwl.display_order, hwl.is_default,
             l.name, l.country, l.owm_city_id, l.lat, l.lng, l.timezone
      FROM hotel_weather_localities hwl
      JOIN localities l ON l.id = hwl.locality_id
      WHERE hwl.hotel_id = ?
      ORDER BY hwl.display_order
    `, [req.params.hotelId]);
    res.json(rows);
  } catch (err) {
    console.error('[super/weather GET /hotels/:hotelId]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter une localité à un hôtel (max 5)
router.post('/hotels/:hotelId', async (req, res) => {
  try {
    const hotelId = req.params.hotelId;
    const { locality_id, display_order, is_default = false } = req.body;
    if (!locality_id) return res.status(400).json({ error: 'locality_id requis' });

    // Vérifier la limite de 5
    const [count] = await db.query(
      'SELECT COUNT(*) AS total FROM hotel_weather_localities WHERE hotel_id = ?', [hotelId]
    );
    if (count[0].total >= 5) {
      return res.status(400).json({ error: 'Maximum 5 localités par hôtel atteint' });
    }

    // Calculer display_order si non fourni
    const order = display_order || (count[0].total + 1);

    // Si is_default, retirer l'ancien défaut
    if (is_default) {
      await db.query(
        'UPDATE hotel_weather_localities SET is_default = 0 WHERE hotel_id = ?', [hotelId]
      );
    }

    await db.query(
      `INSERT INTO hotel_weather_localities (hotel_id, locality_id, display_order, is_default)
       VALUES (?, ?, ?, ?)`,
      [hotelId, locality_id, order, is_default]
    );

    const [rows] = await db.query(`
      SELECT hwl.*, l.name, l.country FROM hotel_weather_localities hwl
      JOIN localities l ON l.id = hwl.locality_id
      WHERE hwl.hotel_id = ? ORDER BY hwl.display_order
    `, [hotelId]);
    res.status(201).json(rows);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette localité est déjà affectée à cet hôtel' });
    console.error('[super/weather POST /hotels/:hotelId]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer une localité d'un hôtel
router.delete('/hotels/:hotelId/:localityId', async (req, res) => {
  try {
    const { hotelId, localityId } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM hotel_weather_localities WHERE hotel_id = ? AND locality_id = ?',
      [hotelId, localityId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Affectation introuvable' });

    await db.query(
      'DELETE FROM hotel_weather_localities WHERE hotel_id = ? AND locality_id = ?',
      [hotelId, localityId]
    );
    res.json({ message: 'Localité retirée' });
  } catch (err) {
    console.error('[super/weather DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Définir la localité par défaut d'un hôtel
router.put('/hotels/:hotelId/:localityId/default', async (req, res) => {
  try {
    const { hotelId, localityId } = req.params;
    // Retirer l'ancien défaut
    await db.query(
      'UPDATE hotel_weather_localities SET is_default = 0 WHERE hotel_id = ?', [hotelId]
    );
    // Définir le nouveau
    const [result] = await db.query(
      'UPDATE hotel_weather_localities SET is_default = 1 WHERE hotel_id = ? AND locality_id = ?',
      [hotelId, localityId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Affectation introuvable' });
    res.json({ message: 'Localité par défaut mise à jour' });
  } catch (err) {
    console.error('[super/weather PUT /default]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rafraîchissement forcé du cache météo pour une localité
router.post('/refresh/:localityId', async (req, res) => {
  try {
    const [localities] = await db.query('SELECT * FROM localities WHERE id = ?', [req.params.localityId]);
    if (!localities[0]) return res.status(404).json({ error: 'Localité introuvable' });

    const { refreshWeatherForLocality } = require('../../../services/weatherRefresh');
    await refreshWeatherForLocality(localities[0]);

    res.json({ message: `Météo rafraîchie pour ${localities[0].name}`, fetched_at: new Date() });
  } catch (err) {
    console.error('[super/weather POST /refresh]', err);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement' });
  }
});

module.exports = router;
