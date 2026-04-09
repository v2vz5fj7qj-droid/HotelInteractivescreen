// Modèle HotelTip (Bon à savoir) — requêtes DB
const db = require('../services/db');

module.exports = {
  findByHotel: (hotelId) =>
    db.query(
      'SELECT * FROM hotel_tips WHERE hotel_id = ? AND is_active = 1 ORDER BY display_order',
      [hotelId]
    ),

  findById: (id) => db.query('SELECT * FROM hotel_tips WHERE id = ?', [id]),

  create: (data) => db.query('INSERT INTO hotel_tips SET ?', [data]),

  update: (id, data) => db.query('UPDATE hotel_tips SET ? WHERE id = ?', [data, id]),

  delete: (id) => db.query('DELETE FROM hotel_tips WHERE id = ?', [id]),
};
