// Super-admin — Journal d'activité (audit_log)
// GET /api/admin/super/audit-log
//   ?entity_type=place|event|useful_info|hotel|user|airport|...
//   ?user_id=X
//   ?action=create|update|delete|publish|reject|...
//   ?from=YYYY-MM-DD  &to=YYYY-MM-DD
//   ?page=1  &per_page=50
const express = require('express');
const router  = express.Router();
const db      = require('../../../services/db');

router.get('/', async (req, res) => {
  try {
    const { entity_type, user_id, action, from, to } = req.query;
    const page     = Math.max(1, parseInt(req.query.page)     || 1);
    const per_page = Math.min(100, parseInt(req.query.per_page) || 50);
    const offset   = (page - 1) * per_page;

    const conditions = [];
    const params     = [];

    if (entity_type) { conditions.push('a.entity_type = ?'); params.push(entity_type); }
    if (user_id)     { conditions.push('a.user_id = ?');     params.push(user_id); }
    if (action)      { conditions.push('a.action = ?');      params.push(action); }
    if (from)        { conditions.push('a.created_at >= ?'); params.push(from); }
    if (to)          { conditions.push('a.created_at <= ?'); params.push(to + ' 23:59:59'); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_log a ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT a.*, u.email AS user_email, u.role AS user_role
       FROM audit_log a
       LEFT JOIN admin_users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, per_page, offset]
    );

    res.json({
      data: rows,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    });
  } catch (err) {
    console.error('[super/audit-log GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
