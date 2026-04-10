// Super-admin — Gestion des utilisateurs admin
// GET    /api/admin/super/users          ?search=&role=&page=&per_page=
// GET    /api/admin/super/users/:id
// POST   /api/admin/super/users
// PUT    /api/admin/super/users/:id
// DELETE /api/admin/super/users/:id  (désactivation)
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const db      = require('../../../services/db');

const VALID_ROLES = ['super_admin', 'hotel_admin', 'hotel_staff', 'contributor'];

async function auditLog(userId, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, 'user', ?, ?, ?)`,
    [userId, action, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

// Lister les utilisateurs (avec recherche + filtre rôle + pagination)
router.get('/', async (req, res) => {
  try {
    const { search, role } = req.query;
    const conditions = [];
    const params     = [];
    if (search) { conditions.push('(u.email LIKE ?)'); params.push(`%${search}%`); }
    if (role)   { conditions.push('u.role = ?');        params.push(role); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Sans ?page → tout retourner
    if (!req.query.page) {
      const [rows] = await db.query(
        `SELECT u.id, u.hotel_id, u.email, u.role,
                u.can_submit_places, u.can_submit_events, u.can_submit_info,
                u.is_active, u.created_at, h.nom AS hotel_nom
         FROM admin_users u LEFT JOIN hotels h ON h.id = u.hotel_id
         ${where} ORDER BY u.role, u.email`,
        params
      );
      return res.json(rows);
    }

    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.min(100, parseInt(req.query.per_page) || 25);
    const offset   = (page - 1) * per_page;

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM admin_users u ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT u.id, u.hotel_id, u.email, u.role,
              u.can_submit_places, u.can_submit_events, u.can_submit_info,
              u.is_active, u.created_at, h.nom AS hotel_nom
       FROM admin_users u LEFT JOIN hotels h ON h.id = u.hotel_id
       ${where} ORDER BY u.role, u.email LIMIT ? OFFSET ?`,
      [...params, per_page, offset]
    );
    res.json({ data: rows, total, page, per_page, total_pages: Math.ceil(total / per_page) });
  } catch (err) {
    console.error('[super/users GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détail d'un utilisateur
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.hotel_id, u.email, u.role,
              u.can_submit_places, u.can_submit_events, u.can_submit_info,
              u.is_active, u.created_at, h.nom AS hotel_nom
       FROM admin_users u LEFT JOIN hotels h ON h.id = u.hotel_id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[super/users GET/:id]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un utilisateur
router.post('/', async (req, res) => {
  try {
    const {
      email, password, role, hotel_id,
      can_submit_places = false,
      can_submit_events = false,
      can_submit_info   = false,
    } = req.body;

    if (!email || !password || !role) return res.status(400).json({ error: 'email, password et role requis' });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `Role invalide. Valeurs: ${VALID_ROLES.join(', ')}` });
    if (['hotel_admin', 'hotel_staff'].includes(role) && !hotel_id) {
      return res.status(400).json({ error: 'hotel_id requis pour ce rôle' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO admin_users
         (hotel_id, email, password_hash, role, can_submit_places, can_submit_events, can_submit_info)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [hotel_id || null, email, password_hash, role, can_submit_places, can_submit_events, can_submit_info]
    );
    const id = result.insertId;
    await auditLog(req.user.id, 'create', id, null, { email, role, hotel_id });

    const [rows] = await db.query(
      'SELECT id, hotel_id, email, role, can_submit_places, can_submit_events, can_submit_info, is_active, created_at FROM admin_users WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    console.error('[super/users POST]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un utilisateur
router.put('/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Utilisez les paramètres de votre propre compte pour vous modifier' });
    }
    const [existing] = await db.query(
      'SELECT id, email, role, hotel_id, is_active FROM admin_users WHERE id = ?', [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { email, password, role, hotel_id, can_submit_places, can_submit_events, can_submit_info, is_active } = req.body;
    const fields = {};
    if (email             !== undefined) fields.email             = email;
    if (role              !== undefined) {
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Role invalide' });
      fields.role = role;
    }
    if (hotel_id          !== undefined) fields.hotel_id          = hotel_id || null;
    if (can_submit_places !== undefined) fields.can_submit_places = can_submit_places;
    if (can_submit_events !== undefined) fields.can_submit_events = can_submit_events;
    if (can_submit_info   !== undefined) fields.can_submit_info   = can_submit_info;
    if (is_active         !== undefined) fields.is_active         = is_active;
    if (password)                        fields.password_hash      = await bcrypt.hash(password, 10);

    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucun champ à modifier' });

    await db.query('UPDATE admin_users SET ? WHERE id = ?', [fields, req.params.id]);
    const logged = { ...fields }; delete logged.password_hash;
    await auditLog(req.user.id, 'update', req.params.id, existing[0], logged);

    const [rows] = await db.query(
      'SELECT id, hotel_id, email, role, can_submit_places, can_submit_events, can_submit_info, is_active FROM admin_users WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    console.error('[super/users PUT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Désactiver un utilisateur (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Impossible de désactiver votre propre compte' });
    }
    const [rows] = await db.query('SELECT id FROM admin_users WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    await db.query('UPDATE admin_users SET is_active = 0 WHERE id = ?', [req.params.id]);
    await auditLog(req.user.id, 'deactivate', req.params.id, { is_active: 1 }, { is_active: 0 });
    res.json({ message: 'Utilisateur désactivé' });
  } catch (err) {
    console.error('[super/users DELETE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
