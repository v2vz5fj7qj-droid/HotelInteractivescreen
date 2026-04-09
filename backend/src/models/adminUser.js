// Modèle AdminUser — requêtes DB
const db = require('../services/db');

module.exports = {
  findByEmail: (email) =>
    db.query('SELECT * FROM admin_users WHERE email = ? AND is_active = 1', [email]),

  findById: (id) =>
    db.query('SELECT id, hotel_id, email, role, can_submit_places, can_submit_events, can_submit_info FROM admin_users WHERE id = ?', [id]),

  findByHotel: (hotelId) =>
    db.query('SELECT id, email, role, is_active FROM admin_users WHERE hotel_id = ?', [hotelId]),

  create: (data) => db.query('INSERT INTO admin_users SET ?', [data]),

  update: (id, data) => db.query('UPDATE admin_users SET ? WHERE id = ?', [data, id]),

  deactivate: (id) => db.query('UPDATE admin_users SET is_active = 0 WHERE id = ?', [id]),
};
