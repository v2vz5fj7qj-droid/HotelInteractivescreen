// Modèle Airport — requêtes DB
const db = require('../services/db');

module.exports = {
  findAll: () => db.query('SELECT * FROM airports ORDER BY code'),

  findByCode: (code) => db.query('SELECT * FROM airports WHERE code = ?', [code]),

  findByHotel: (hotelId) =>
    db.query(`
      SELECT a.*, ha.display_order
      FROM airports a
      JOIN hotel_airports ha ON ha.airport_code = a.code AND ha.hotel_id = ?
      ORDER BY ha.display_order
    `, [hotelId]),

  create: (data) => db.query('INSERT INTO airports SET ?', [data]),

  update: (code, data) => db.query('UPDATE airports SET ? WHERE code = ?', [data, code]),

  delete: (code) => db.query('DELETE FROM airports WHERE code = ?', [code]),

  updateLastFetched: (code) =>
    db.query('UPDATE airports SET last_fetched_at = NOW() WHERE code = ?', [code]),

  assignToHotel: (hotelId, airportCode, displayOrder = 0) =>
    db.query(
      'INSERT INTO hotel_airports (hotel_id, airport_code, display_order) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE display_order = ?',
      [hotelId, airportCode, displayOrder, displayOrder]
    ),

  removeFromHotel: (hotelId, airportCode) =>
    db.query('DELETE FROM hotel_airports WHERE hotel_id = ? AND airport_code = ?', [hotelId, airportCode]),

  // Aéroports avec planification active
  findScheduled: () =>
    db.query('SELECT * FROM airports WHERE schedule_enabled = 1'),
};
