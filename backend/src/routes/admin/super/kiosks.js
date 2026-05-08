// Gestion des bornes kiosques — super-admin
// GET    /api/admin/super/kiosks              — liste toutes les bornes
// POST   /api/admin/super/kiosks/keys         — génère une clé d'inscription
// GET    /api/admin/super/kiosks/keys         — liste les clés générées
// PUT    /api/admin/super/kiosks/:id          — modifier label / hotel_id
// PUT    /api/admin/super/kiosks/:id/toggle   — activer / désactiver
// DELETE /api/admin/super/kiosks/:id          — supprimer une borne
const express = require('express');
const crypto  = require('crypto');
const db      = require('../../../services/db');

const router  = express.Router();

function auditLog(userId, action, entityId, oldValue, newValue) {
  return db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'kiosk', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

// Formate une clé lisible : XXXXXX-XXXXXX-XXXXXX
function generateKey() {
  const raw = crypto.randomBytes(9).toString('hex').toUpperCase();
  return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
}

// GET /api/admin/super/kiosks
router.get('/', async (req, res) => {
  const { hotel_id, page, per_page = 20 } = req.query;

  try {
    const filters = [];
    const params  = [];

    if (hotel_id) {
      filters.push('k.hotel_id = ?');
      params.push(hotel_id);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    if (page) {
      const p   = Math.max(1, parseInt(page));
      const pp  = Math.min(100, parseInt(per_page));
      const off = (p - 1) * pp;

      const [[{ total }]] = await db.query(
        `SELECT COUNT(*) AS total FROM kiosks k ${where}`,
        params
      );

      const [rows] = await db.query(
        `SELECT k.id, k.hotel_id, h.nom AS hotel_nom, h.slug AS hotel_slug,
                k.label, k.fingerprint, k.is_enabled, k.last_seen_at, k.registered_at,
                CASE
                  WHEN k.is_enabled = 0 THEN 'disabled'
                  WHEN k.last_seen_at IS NULL THEN 'never_seen'
                  WHEN k.last_seen_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 'online'
                  ELSE 'offline'
                END AS status
         FROM kiosks k
         JOIN hotels h ON h.id = k.hotel_id
         ${where}
         ORDER BY k.registered_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pp, off]
      );

      return res.json({ data: rows, total, page: p, per_page: pp, total_pages: Math.ceil(total / pp) });
    }

    const [rows] = await db.query(
      `SELECT k.id, k.hotel_id, h.nom AS hotel_nom, h.slug AS hotel_slug,
              k.label, k.fingerprint, k.is_enabled, k.last_seen_at, k.registered_at,
              CASE
                WHEN k.is_enabled = 0 THEN 'disabled'
                WHEN k.last_seen_at IS NULL THEN 'never_seen'
                WHEN k.last_seen_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 'online'
                ELSE 'offline'
              END AS status
       FROM kiosks k
       JOIN hotels h ON h.id = k.hotel_id
       ${where}
       ORDER BY k.registered_at DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('[super/kiosks GET]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/super/kiosks/keys — générer une clé d'inscription
// Body: { hotel_id, expires_hours? }
router.post('/keys', async (req, res) => {
  const { hotel_id, expires_hours = 72 } = req.body;

  if (!hotel_id) return res.status(400).json({ error: 'hotel_id requis' });

  try {
    const [[hotel]] = await db.query('SELECT id FROM hotels WHERE id = ? AND is_active = 1', [hotel_id]);
    if (!hotel) return res.status(404).json({ error: 'Hôtel introuvable' });

    const keyValue  = generateKey();
    const expiresAt = new Date(Date.now() + expires_hours * 3600 * 1000);

    await db.query(
      `INSERT INTO kiosk_keys (hotel_id, key_value, expires_at, created_by)
       VALUES (?, ?, ?, ?)`,
      [hotel_id, keyValue, expiresAt, req.user.id]
    );

    await auditLog(req.user.id, 'generate_key', null, null, { hotel_id, key: keyValue });

    return res.status(201).json({ key: keyValue, expires_at: expiresAt });
  } catch (err) {
    console.error('[super/kiosks/keys POST]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/super/kiosks/keys — historique des clés
router.get('/keys', async (req, res) => {
  const { hotel_id } = req.query;

  try {
    const filters = [];
    const params  = [];

    if (hotel_id) {
      filters.push('kk.hotel_id = ?');
      params.push(hotel_id);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT kk.id, kk.hotel_id, h.nom AS hotel_nom, kk.key_value,
              kk.kiosk_id, kk.used_at, kk.expires_at, kk.created_by,
              CASE
                WHEN kk.used_at IS NOT NULL THEN 'used'
                WHEN kk.expires_at < NOW() THEN 'expired'
                ELSE 'available'
              END AS key_status
       FROM kiosk_keys kk
       JOIN hotels h ON h.id = kk.hotel_id
       ${where}
       ORDER BY kk.id DESC
       LIMIT 100`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('[super/kiosks/keys GET]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/super/kiosks/:id — modifier label ou hotel_id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { label, hotel_id } = req.body;

  if (!label && !hotel_id) return res.status(400).json({ error: 'Aucun champ à modifier' });

  try {
    const [[kiosk]] = await db.query('SELECT * FROM kiosks WHERE id = ?', [id]);
    if (!kiosk) return res.status(404).json({ error: 'Borne introuvable' });

    const fields = [];
    const params = [];

    if (label !== undefined) { fields.push('label = ?');    params.push(label);    }
    if (hotel_id !== undefined) { fields.push('hotel_id = ?'); params.push(hotel_id); }

    params.push(id);
    await db.query(`UPDATE kiosks SET ${fields.join(', ')} WHERE id = ?`, params);
    await auditLog(req.user.id, 'update', id, kiosk, { label, hotel_id });

    return res.json({ message: 'Borne mise à jour' });
  } catch (err) {
    console.error('[super/kiosks PUT]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/super/kiosks/:id/toggle — activer / désactiver
router.put('/:id/toggle', async (req, res) => {
  const { id } = req.params;

  try {
    const [[kiosk]] = await db.query('SELECT id, is_enabled FROM kiosks WHERE id = ?', [id]);
    if (!kiosk) return res.status(404).json({ error: 'Borne introuvable' });

    const newState = kiosk.is_enabled ? 0 : 1;
    await db.query('UPDATE kiosks SET is_enabled = ? WHERE id = ?', [newState, id]);
    await auditLog(req.user.id, newState ? 'enable' : 'disable', id, { is_enabled: kiosk.is_enabled }, { is_enabled: newState });

    return res.json({ is_enabled: newState });
  } catch (err) {
    console.error('[super/kiosks/toggle PUT]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/super/kiosks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [[kiosk]] = await db.query('SELECT id, label FROM kiosks WHERE id = ?', [id]);
    if (!kiosk) return res.status(404).json({ error: 'Borne introuvable' });

    await db.query('DELETE FROM kiosks WHERE id = ?', [id]);
    await auditLog(req.user.id, 'delete', id, kiosk, null);

    return res.json({ message: 'Borne supprimée' });
  } catch (err) {
    console.error('[super/kiosks DELETE]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
