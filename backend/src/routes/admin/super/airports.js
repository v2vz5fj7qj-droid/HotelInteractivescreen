// Super-admin — Gestion des aéroports et planification
// GET    /api/admin/super/airports
// GET    /api/admin/super/airports/:code
// POST   /api/admin/super/airports
// PUT    /api/admin/super/airports/:code
// DELETE /api/admin/super/airports/:code
// POST   /api/admin/super/airports/:code/refresh         — rafraîchissement forcé
// POST   /api/admin/super/airports/:code/assign          — affecter à un hôtel
// DELETE /api/admin/super/airports/:code/assign/:hotelId — retirer d'un hôtel
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'airport', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  ).catch(() => {});
}

// Génère l'expression cron depuis les champs de planification
function buildCronExpression(schedule_mode, interval_minutes, fixed_hours) {
  if (schedule_mode === 'interval') {
    const min = parseInt(interval_minutes) || 30;
    return `*/${min} * * * *`;
  }
  if (schedule_mode === 'fixed_hours') {
    const hours = Array.isArray(fixed_hours) ? fixed_hours : JSON.parse(fixed_hours || '[]');
    if (!hours.length) return null;
    return `0 ${hours.join(',')} * * *`;
  }
  return null;
}

// Lister tous les aéroports avec leurs hôtels associés
router.get('/', async (req, res) => {
  try {
    const [airports] = await db.query('SELECT * FROM airports ORDER BY code');
    const [assignments] = await db.query(`
      SELECT ha.airport_code, ha.hotel_id, ha.display_order, h.nom AS hotel_nom
      FROM hotel_airports ha
      JOIN hotels h ON h.id = ha.hotel_id
    `);
    // Regrouper les hôtels par aéroport
    const map = {};
    for (const a of airports) map[a.code] = { ...a, hotels: [] };
    for (const a of assignments) {
      if (map[a.airport_code]) map[a.airport_code].hotels.push({
        hotel_id: a.hotel_id, nom: a.hotel_nom, display_order: a.display_order,
      });
    }
    res.json(Object.values(map));
  } catch (err) {
    console.error('[super/airports GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un aéroport
router.get('/:code', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM airports WHERE code = ?', [req.params.code.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ error: 'Aéroport introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/airports GET/:code]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un aéroport
router.post('/', async (req, res) => {
  try {
    const {
      code, label,
      schedule_enabled = true,
      schedule_mode    = 'interval',
      interval_minutes = 30,
      fixed_hours      = null,
    } = req.body;

    if (!code || !label) return res.status(400).json({ error: 'code et label requis' });

    const cron_expression = schedule_enabled
      ? buildCronExpression(schedule_mode, interval_minutes, fixed_hours)
      : null;

    await db.query(
      `INSERT INTO airports (code, label, schedule_enabled, schedule_mode, interval_minutes, fixed_hours, cron_expression)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code.toUpperCase(), label, schedule_enabled, schedule_mode,
       interval_minutes, fixed_hours ? JSON.stringify(fixed_hours) : null, cron_expression]
    );

    const [rows] = await db.query('SELECT * FROM airports WHERE code = ?', [code.toUpperCase()]);
    await auditLog(req.user.id, 'create', code.toUpperCase(), null, { code, label, schedule_mode });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce code aéroport existe déjà' });
    console.error('[super/airports POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un aéroport (regenère cron_expression automatiquement)
router.put('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [existing] = await db.query('SELECT * FROM airports WHERE code = ?', [code]);
    if (!existing[0]) return res.status(404).json({ error: 'Aéroport introuvable' });

    const {
      label, schedule_enabled, schedule_mode,
      interval_minutes, fixed_hours,
    } = req.body;

    const fields = {};
    if (label            !== undefined) fields.label            = label;
    if (schedule_enabled !== undefined) fields.schedule_enabled = schedule_enabled;
    if (schedule_mode    !== undefined) fields.schedule_mode    = schedule_mode;
    if (interval_minutes !== undefined) fields.interval_minutes = interval_minutes;
    if (fixed_hours      !== undefined) fields.fixed_hours      = JSON.stringify(fixed_hours);

    // Recalculer cron_expression si la planification change
    const merged = { ...existing[0], ...fields };
    fields.cron_expression = merged.schedule_enabled
      ? buildCronExpression(merged.schedule_mode, merged.interval_minutes, merged.fixed_hours)
      : null;

    await db.query('UPDATE airports SET ? WHERE code = ?', [fields, code]);
    await auditLog(req.user.id, 'update', code, existing[0], fields);
    const [rows] = await db.query('SELECT * FROM airports WHERE code = ?', [code]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/airports PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un aéroport
router.delete('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [rows] = await db.query('SELECT code FROM airports WHERE code = ?', [code]);
    if (!rows[0]) return res.status(404).json({ error: 'Aéroport introuvable' });
    await db.query('DELETE FROM airports WHERE code = ?', [code]);
    await auditLog(req.user.id, 'delete', code, rows[0], null);
    res.json({ message: 'Aéroport supprimé' });
  } catch (err) {
    console.error('[super/airports DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rafraîchissement forcé des vols pour un aéroport
router.post('/:code/refresh', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [rows] = await db.query('SELECT * FROM airports WHERE code = ?', [code]);
    if (!rows[0]) return res.status(404).json({ error: 'Aéroport introuvable' });

    // Déclencher le refresh via le service existant
    const { refreshFlightsForAirport } = require('../../../services/flightRefresh');
    await refreshFlightsForAirport(code);

    await db.query('UPDATE airports SET last_fetched_at = NOW() WHERE code = ?', [code]);
    res.json({ message: `Vols rafraîchis pour ${code}`, fetched_at: new Date() });
  } catch (err) {
    console.error('[super/airports POST /refresh]', err);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement' });
  }
});

// Affecter un aéroport à un hôtel
router.post('/:code/assign', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { hotel_id, display_order = 0 } = req.body;
    if (!hotel_id) return res.status(400).json({ error: 'hotel_id requis' });

    await db.query(
      `INSERT INTO hotel_airports (hotel_id, airport_code, display_order)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE display_order = ?`,
      [hotel_id, code, display_order, display_order]
    );
    res.json({ message: `${code} affecté à l'hôtel ${hotel_id}` });
  } catch (err) {
    console.error('[super/airports POST /assign]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer un aéroport d'un hôtel
router.delete('/:code/assign/:hotelId', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM hotel_airports WHERE airport_code = ? AND hotel_id = ?',
      [req.params.code.toUpperCase(), req.params.hotelId]
    );
    res.json({ message: 'Affectation supprimée' });
  } catch (err) {
    console.error('[super/airports DELETE /assign]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
