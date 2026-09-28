// guestAuth — exige un jeton visiteur valide (séjour en cours).
// Peuple req.guest = { hotelId, codeId, sessionId, stay }.
// À n'utiliser que sur les routes réservées au client authentifié par son code.
const guest = require('../services/guestAccess');

function extractBearer(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7) || null;
}

module.exports = async function guestAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ reason: 'no_token', error: 'Jeton visiteur requis' });

  try {
    const session = await guest.verifyGuestToken(token);
    // Un jeton signé mais dont le séjour est terminé ou révoqué tombe ici :
    // le front distingue ce cas pour afficher « Séjour terminé ».
    if (!session) {
      return res.status(401).json({ reason: 'expired', error: 'Séjour terminé ou accès révoqué' });
    }

    req.guest   = session;
    req.hotelId = session.hotelId;
    next();
  } catch (err) {
    console.error('[guestAuth]', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports.extractBearer = extractBearer;
