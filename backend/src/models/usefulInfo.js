// Modèle UsefulInfo (Infos utiles) — requêtes DB
const db = require('../services/db');

module.exports = {
  // Public — contacts publiés
  findPublished: (locale) =>
    db.query(`
      SELECT u.*, uct.name, uct.description, uct.address
      FROM useful_contacts u
      LEFT JOIN useful_contact_translations uct ON uct.contact_id = u.id AND uct.locale = ?
      WHERE u.status = 'published' AND u.is_active = 1
      ORDER BY u.display_order
    `, [locale]),

  findById: (id) => db.query('SELECT * FROM useful_contacts WHERE id = ?', [id]),

  create: (data) => db.query('INSERT INTO useful_contacts SET ?', [data]),

  update: (id, data) => db.query('UPDATE useful_contacts SET ? WHERE id = ?', [data, id]),

  updateStatus: (id, status, validatedBy, rejectionReason = null) =>
    db.query(
      'UPDATE useful_contacts SET status = ?, validated_by = ?, validated_at = NOW(), rejection_reason = ? WHERE id = ?',
      [status, validatedBy, rejectionReason, id]
    ),

  findByContributor: (userId) =>
    db.query('SELECT * FROM useful_contacts WHERE created_by = ? ORDER BY created_at DESC', [userId]),

  findPending: () =>
    db.query('SELECT * FROM useful_contacts WHERE status IN ("pending","pre_approved") ORDER BY created_at ASC'),
};
