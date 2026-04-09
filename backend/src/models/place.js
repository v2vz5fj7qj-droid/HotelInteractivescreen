// Modèle Place (POI) — requêtes DB
const db = require('../services/db');

module.exports = {
  // Public — lieux publiés affectés à un hôtel
  findPublishedByHotel: (hotelId, locale) =>
    db.query(`
      SELECT p.*, pt.name, pt.address, pt.description
      FROM points_of_interest p
      JOIN hotel_places hp ON hp.place_id = p.id AND hp.hotel_id = ?
      LEFT JOIN poi_translations pt ON pt.poi_id = p.id AND pt.locale = ?
      WHERE p.status = 'published' AND p.is_active = 1
      ORDER BY hp.display_order
    `, [hotelId, locale]),

  // Super-admin — tous les lieux
  findAll: (status = null) => {
    const where = status ? 'WHERE p.status = ?' : '';
    const params = status ? [status] : [];
    return db.query(`SELECT p.* FROM points_of_interest p ${where} ORDER BY p.created_at DESC`, params);
  },

  findById: (id) => db.query('SELECT * FROM points_of_interest WHERE id = ?', [id]),

  create: (data) => db.query('INSERT INTO points_of_interest SET ?', [data]),

  update: (id, data) => db.query('UPDATE points_of_interest SET ? WHERE id = ?', [data, id]),

  // Workflow
  updateStatus: (id, status, validatedBy, rejectionReason = null) =>
    db.query(
      'UPDATE points_of_interest SET status = ?, validated_by = ?, validated_at = NOW(), rejection_reason = ? WHERE id = ?',
      [status, validatedBy, rejectionReason, id]
    ),

  // Affectation hôtels
  assignToHotel: (hotelId, placeId) =>
    db.query('INSERT IGNORE INTO hotel_places (hotel_id, place_id) VALUES (?, ?)', [hotelId, placeId]),

  removeFromHotel: (hotelId, placeId) =>
    db.query('DELETE FROM hotel_places WHERE hotel_id = ? AND place_id = ?', [hotelId, placeId]),

  findByContributor: (userId) =>
    db.query('SELECT * FROM points_of_interest WHERE created_by = ? ORDER BY created_at DESC', [userId]),
};
