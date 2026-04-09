const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'connectbe_dev_secret';

// Peuple req.user avec le payload JWT (id, role, hotel_id, permissions)
module.exports = function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), SECRET);
    // Rétrocompatibilité — l'ancien code utilisait req.admin
    req.admin = req.user;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};
