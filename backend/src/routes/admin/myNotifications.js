// Notifications workflow — lecture et marquage pour l'utilisateur connecté
// GET  /api/admin/notifications        — mes notifications (unread first)
// PUT  /api/admin/notifications/:id/read
// PUT  /api/admin/notifications/read-all
// GET  /api/admin/notifications/count  — compteur non lus
const express = require('express');
const router  = express.Router();
const db      = require('../../services/db');

// Compteur non lus — appelé fréquemment pour le badge
router.get('/count', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) AS unread FROM workflow_notifications WHERE recipient_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ unread: rows[0].unread });
  } catch (err) {
    console.error('[notifications GET /count]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister mes notifications (50 max, unread first)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM workflow_notifications
       WHERE recipient_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[notifications GET]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer une notification comme lue
router.put('/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE workflow_notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marquée comme lue' });
  } catch (err) {
    console.error('[notifications PUT /read]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Tout marquer comme lu
router.put('/read-all', async (req, res) => {
  try {
    await db.query(
      'UPDATE workflow_notifications SET is_read = 1 WHERE recipient_id = ?',
      [req.user.id]
    );
    res.json({ message: 'Toutes marquées comme lues' });
  } catch (err) {
    console.error('[notifications PUT /read-all]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
