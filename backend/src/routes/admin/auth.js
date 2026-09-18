// Route d'authentification — tous les rôles
// POST /api/admin/login
// POST /api/admin/logout
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const db       = require('../../services/db');
const { JWT_SECRET } = require('../../config/secrets');

const COOKIE_NAME = 'admin_token';
const COOKIE_OPTS = {
  httpOnly:  true,   // Inaccessible au JavaScript — protection XSS
  secure:    process.env.NODE_ENV === 'production', // HTTPS uniquement en prod
  sameSite:  'Strict',
  path:      '/api/admin',
  // Pas de maxAge → cookie de session (disparaît à la fermeture du navigateur)
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const [rows] = await db.query(
      `SELECT u.*, h.slug AS hotel_slug
       FROM admin_users u
       LEFT JOIN hotels h ON h.id = u.hotel_id
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const payload = {
      id:                user.id,
      role:              user.role,
      hotel_id:          user.hotel_id,
      can_submit_places: !!user.can_submit_places,
      can_submit_events: !!user.can_submit_events,
      can_submit_info:   !!user.can_submit_info,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    // Token dans un cookie HttpOnly — jamais exposé au JavaScript
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    // Le body ne contient que les métadonnées non-sensibles pour l'UI
    res.json({
      role:        user.role,
      hotel_id:    user.hotel_id,
      hotel_slug:  user.hotel_slug || null,
      email:       user.email,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: 0 });
  res.json({ ok: true });
});

module.exports = router;
