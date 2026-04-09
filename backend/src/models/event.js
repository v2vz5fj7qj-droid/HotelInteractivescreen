// Modèle Event — requêtes DB
const db = require('../services/db');

module.exports = {
  // Public — événements publiés (globaux + hôtel concerné)
  findPublishedByHotel: (hotelId, locale) =>
    db.query(`
      SELECT e.*, et.title, et.description, et.tags
      FROM events e
      LEFT JOIN event_translations et ON et.event_id = e.id AND et.locale = ?
      WHERE e.status = 'published'
        AND e.is_active = 1
        AND (e.hotel_id IS NULL OR e.hotel_id = ?)
      ORDER BY e.start_date ASC
    `, [locale, hotelId]),

  findById: (id) => db.query('SELECT * FROM events WHERE id = ?', [id]),

  create: (data) => db.query('INSERT INTO events SET ?', [data]),

  update: (id, data) => db.query('UPDATE events SET ? WHERE id = ?', [data, id]),

  updateStatus: (id, status, validatedBy, rejectionReason = null) =>
    db.query(
      'UPDATE events SET status = ?, validated_by = ?, validated_at = NOW(), rejection_reason = ? WHERE id = ?',
      [status, validatedBy, rejectionReason, id]
    ),

  archive: (id) =>
    db.query('UPDATE events SET status = "archived", archived_at = NOW() WHERE id = ?', [id]),

  // Archivage automatique des événements datés passés
  archiveExpired: () =>
    db.query(`
      UPDATE events
      SET status = 'archived', archived_at = NOW()
      WHERE status = 'published'
        AND auto_archive = 1
        AND end_date IS NOT NULL
        AND end_date < CURDATE()
    `),

  findByHotelAdmin: (hotelId) =>
    db.query('SELECT * FROM events WHERE hotel_id = ? ORDER BY created_at DESC', [hotelId]),

  findByContributor: (userId) =>
    db.query('SELECT * FROM events WHERE created_by = ? ORDER BY created_at DESC', [userId]),

  findPending: () =>
    db.query('SELECT * FROM events WHERE status IN ("pending","pre_approved") ORDER BY created_at ASC'),
};
