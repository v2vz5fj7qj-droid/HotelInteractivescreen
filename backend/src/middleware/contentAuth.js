// contentAuth — garde des routes de contenu du front-office.
//
// Trois porteurs légitimes, dans cet ordre de vérification :
//   1. guest_token  — un client authentifié par son code de séjour (JWT signé)
//   2. device_token — une borne kiosque inscrite (96 caractères hexadécimaux)
//   3. qr_token     — le transfert mobile éphémère existant (UUID, TTL court)
//
// Le contenu était jusqu'ici entièrement public : n'importe qui pouvait lire les
// données d'un hôtel en connaissant son id. Ce middleware referme cet accès sans
// casser les deux usages historiques.
//
// Bascule progressive : tant que CONTENT_AUTH_ENFORCE n'est pas 'true', une
// requête sans jeton est servie mais journalisée. Cela permet de déployer, de
// vérifier dans les journaux qu'aucun appel légitime ne tombe, puis de verrouiller
// — sans risquer d'éteindre les bornes en production au premier redémarrage.
const db    = require('../services/db');
const guest = require('../services/guestAccess');
const { extractBearer } = require('./guestAuth');

const ENFORCE = process.env.CONTENT_AUTH_ENFORCE === 'true';

// Journalisation du mode observation : une ligne par requête inonderait les
// journaux (la borne interroge la météo en boucle). On ne trace donc qu'une fois
// par minute et par chemin, ce qui suffit pour repérer un appel légitime oublié.
const LOG_THROTTLE_MS = 60_000;
const lastLogged = new Map();

function logOnce(method, path) {
  const key  = `${method} ${path}`;
  const now  = Date.now();
  const seen = lastLogged.get(key);
  if (seen && now - seen < LOG_THROTTLE_MS) return;
  lastLogged.set(key, now);
  console.warn(`[contentAuth] toléré (mode observation) — ${key}`);
}

const RE_DEVICE = /^[a-f0-9]{96}$/i;
const RE_UUID   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Identifie le porteur. Retourne { kind, hotelId, sessionId? } ou null.
async function identify(token) {
  // 1. Jeton visiteur — seul format à comporter des points (JWT)
  if (token.includes('.')) {
    const session = await guest.verifyGuestToken(token);
    if (!session) return null;
    return { kind: 'guest', hotelId: session.hotelId, sessionId: session.sessionId };
  }

  // 2. Jeton de borne
  if (RE_DEVICE.test(token)) {
    const [[kiosk]] = await db.query(
      `SELECT k.id, k.hotel_id, k.is_enabled
       FROM kiosks k
       JOIN hotels h ON h.id = k.hotel_id
       WHERE k.device_token = ? AND h.is_active = 1
       LIMIT 1`,
      [token]
    );
    if (!kiosk || !kiosk.is_enabled) return null;
    return { kind: 'kiosk', hotelId: kiosk.hotel_id };
  }

  // 3. Jeton QR éphémère du transfert mobile
  if (RE_UUID.test(token)) {
    const [[qr]] = await db.query(
      'SELECT hotel_id FROM qr_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1',
      [token]
    );
    if (!qr) return null;
    return { kind: 'qr', hotelId: qr.hotel_id };
  }

  return null;
}

module.exports = async function contentAuth(req, res, next) {
  const token = extractBearer(req);

  try {
    const access = token ? await identify(token) : null;

    if (!access) {
      if (!ENFORCE) {
        logOnce(req.method, req.baseUrl + req.path);
        return next();
      }
      return res.status(401).json({
        reason: token ? 'invalid_token' : 'no_token',
        error:  'Accès réservé — code de séjour requis',
      });
    }

    // Cloisonnement inter-hôtels : un jeton d'un hôtel ne lit pas les données
    // d'un autre, même en changeant le paramètre hotel_id de la requête.
    const asked = parseInt(req.query.hotel_id ?? req.body?.hotel_id, 10);
    if (Number.isInteger(asked) && asked !== access.hotelId) {
      return res.status(403).json({ reason: 'hotel_mismatch', error: 'Accès refusé' });
    }

    req.access  = access;
    req.hotelId = access.hotelId;
    if (access.kind === 'guest') guest.touchSession(access.sessionId);

    next();
  } catch (err) {
    console.error('[contentAuth]', err.message);
    if (!ENFORCE) return next();
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports.ENFORCE  = ENFORCE;
// Exporté pour les routes qui adaptent leur réponse sans exiger de jeton
// (voir routes/kiosk.js : configuration publique expurgée de ses secrets).
module.exports.identify = identify;
