const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secrets');

// Peuple req.user avec le payload JWT (id, role, hotel_id, permissions)
// Lit le token depuis le cookie HttpOnly admin_token en priorité,
// puis depuis l'en-tête Authorization: Bearer (Postman / appels serveur-à-serveur)
module.exports = function adminAuth(req, res, next) {
  const token = req.cookies?.admin_token
    ?? (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    req.user  = jwt.verify(token, JWT_SECRET);
    req.admin = req.user; // rétrocompatibilité
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};
