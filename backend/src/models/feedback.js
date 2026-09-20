// Modèle Feedback — avis clients soumis depuis la borne kiosque.
// Les notes sont stockées en JSON par catégorie (proprete, accueil, chambre, restauration, services).
// L'IP est conservée pour le rate-limiting et la détection de doublons quotidiens.
const db = require('../services/db');

// Insère un nouvel avis. Retourne l'ID inséré.
async function create({ hotel_id, categories, commentaire, note_globale, locale, ip }) {
  const [result] = await db.query(
    `INSERT INTO feedbacks (hotel_id, categories, commentaire, note_globale, locale, ip)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [hotel_id, JSON.stringify(categories), commentaire || null, note_globale, locale || 'fr', ip || null]
  );
  return result.insertId;
}

// Vérifie si l'IP a déjà soumis un avis aujourd'hui pour cet hôtel (anti-spam).
async function hasSubmittedToday(hotel_id, ip) {
  if (!ip) return false;
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM feedbacks
     WHERE hotel_id = ? AND ip = ? AND DATE(created_at) = CURDATE()`,
    [hotel_id, ip]
  );
  return rows[0].cnt > 0;
}

// Liste les avis d'un hôtel avec filtres optionnels (plage de dates, note minimale,
// présence d'un commentaire, recherche plein texte dans le commentaire) et pagination.
async function list({ hotel_id, limit = 50, offset = 0, from, to, min_note, has_comment, q }) {
  const params = [hotel_id];
  let where = 'WHERE hotel_id = ?';
  if (from)        { where += ' AND DATE(created_at) >= ?';            params.push(from); }
  if (to)          { where += ' AND DATE(created_at) <= ?';            params.push(to); }
  if (min_note)    { where += ' AND note_globale >= ?';                params.push(parseFloat(min_note)); }
  if (has_comment) { where += " AND commentaire IS NOT NULL AND commentaire != ''"; }
  if (q)           { where += ' AND commentaire LIKE ?';               params.push(`%${q}%`); }

  const [rows] = await db.query(
    `SELECT id, categories, commentaire, note_globale, locale, created_at
     FROM feedbacks ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), parseInt(offset)]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM feedbacks ${where}`,
    params
  );
  return { rows, total };
}

// Calcule les statistiques globales + tendance sur 30 jours (1 point par jour).
async function stats(hotel_id) {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS total,
       ROUND(AVG(note_globale), 2) AS moyenne_globale,
       ROUND(AVG(JSON_EXTRACT(categories, '$.proprete')),    2) AS moy_proprete,
       ROUND(AVG(JSON_EXTRACT(categories, '$.accueil')),     2) AS moy_accueil,
       ROUND(AVG(JSON_EXTRACT(categories, '$.chambre')),     2) AS moy_chambre,
       ROUND(AVG(JSON_EXTRACT(categories, '$.restauration')),2) AS moy_restauration,
       ROUND(AVG(JSON_EXTRACT(categories, '$.services')),    2) AS moy_services,
       SUM(CASE WHEN commentaire IS NOT NULL AND commentaire != '' THEN 1 ELSE 0 END) AS avec_commentaire,
       SUM(CASE WHEN note_globale <= 2.5 THEN 1 ELSE 0 END) AS a_surveiller
     FROM feedbacks WHERE hotel_id = ?`,
    [hotel_id]
  );
  // Tendance 30 derniers jours (1 ligne par jour)
  const [trend] = await db.query(
    `SELECT DATE(created_at) AS jour, ROUND(AVG(note_globale), 2) AS moy, COUNT(*) AS nb
     FROM feedbacks
     WHERE hotel_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY jour ASC`,
    [hotel_id]
  );
  return { ...rows[0], trend };
}

module.exports = { create, hasSubmittedToday, list, stats };
