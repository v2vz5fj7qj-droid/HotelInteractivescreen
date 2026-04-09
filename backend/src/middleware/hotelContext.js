// Injecte hotel_id dans req depuis le JWT décodé
// À placer après le middleware d'auth (adminAuth)
module.exports = function hotelContext(req, res, next) {
  if (req.user) {
    req.hotelId = req.user.hotel_id || null;
    req.userRole = req.user.role;
  }
  next();
};
