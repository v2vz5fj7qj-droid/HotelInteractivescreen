// Modèle Service (Services et bien-être) — requêtes DB
const db = require('../services/db');

module.exports = {
  // Public — services actifs d'un hôtel
  findPublishedByHotel: (hotelId, locale) =>
    db.query(`
      SELECT s.*, sc.label_fr AS category_fr, sc.label_en AS category_en, sc.icon AS category_icon,
             st.name, st.description, st.benefits
      FROM services s
      JOIN service_categories sc ON sc.id = s.category_id
      LEFT JOIN service_translations st ON st.service_id = s.id AND st.locale = ?
      WHERE s.hotel_id = ? AND s.is_active = 1
      ORDER BY sc.display_order, s.display_order
    `, [locale, hotelId]),

  // Catégories disponibles pour un hôtel (globales + propres)
  findCategoriesByHotel: (hotelId) =>
    db.query(`
      SELECT * FROM service_categories
      WHERE hotel_id IS NULL OR hotel_id = ?
      ORDER BY display_order
    `, [hotelId]),

  // Toutes les catégories globales (super-admin)
  findGlobalCategories: () =>
    db.query('SELECT * FROM service_categories WHERE hotel_id IS NULL ORDER BY display_order'),

  findById: (id) => db.query('SELECT * FROM services WHERE id = ?', [id]),

  create: (data) => db.query('INSERT INTO services SET ?', [data]),

  update: (id, data) => db.query('UPDATE services SET ? WHERE id = ?', [data, id]),

  delete: (id) => db.query('DELETE FROM services WHERE id = ?', [id]),

  createCategory: (data) => db.query('INSERT INTO service_categories SET ?', [data]),

  updateCategory: (id, data) => db.query('UPDATE service_categories SET ? WHERE id = ?', [data, id]),

  deleteCategory: (id) => db.query('DELETE FROM service_categories WHERE id = ?', [id]),
};
