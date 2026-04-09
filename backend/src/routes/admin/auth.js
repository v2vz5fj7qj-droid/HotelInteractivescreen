// Route d'authentification — tous les rôles
// POST /api/admin/login
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AdminUser = require('../../models/adminUser');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const [rows] = await AdminUser.findByEmail(email);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = jwt.sign(
      {
        id:       user.id,
        role:     user.role,
        hotel_id: user.hotel_id,
        can_submit_places: user.can_submit_places,
        can_submit_events: user.can_submit_events,
        can_submit_info:   user.can_submit_info,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      role:     user.role,
      hotel_id: user.hotel_id,
      email:    user.email,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
