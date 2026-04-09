// Modèle Hotel — requêtes DB
const db = require('../services/db');

module.exports = {
  findAll: () => db.query('SELECT * FROM hotels WHERE is_active = 1'),
  findById: (id) => db.query('SELECT * FROM hotels WHERE id = ?', [id]),
  findBySlug: (slug) => db.query('SELECT * FROM hotels WHERE slug = ?', [slug]),
  create: (data) => db.query('INSERT INTO hotels SET ?', [data]),
  update: (id, data) => db.query('UPDATE hotels SET ? WHERE id = ?', [data, id]),
  delete: (id) => db.query('UPDATE hotels SET is_active = 0 WHERE id = ?', [id]),
};
