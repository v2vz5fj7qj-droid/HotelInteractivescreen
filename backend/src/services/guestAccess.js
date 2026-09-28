// guestAccess — cœur métier des codes d'accès client (séjour).
//
// Un code court, remis au client à l'enregistrement, ouvre l'ensemble du menu
// front-office depuis son propre téléphone pendant la durée de son séjour.
// Ce module centralise : le format du code, le calcul de validité, l'échange
// code → jeton de session, et la vérification de ce jeton.
//
// Le jeton est un JWT signé (pas d'aller-retour base à chaque appel), mais son
// empreinte est enregistrée en base : c'est ce qui permet la révocation immédiate
// d'un séjour, le plafond d'appareils et le suivi d'activité du back-office.
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const db     = require('./db');
const { JWT_SECRET } = require('../config/secrets');

// Base32 sans caractères ambigus : ni 0/O, ni 1/I/L, et sans U (évite les
// combinaisons malheureuses sur une fiche remise en main propre).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;

// Marge de courtoisie appliquée après l'heure de départ. Configurable par code
// en base ; cette valeur n'est que le défaut proposé à la création.
const DEFAULT_GRACE_HOURS = parseInt(process.env.GUEST_GRACE_HOURS || '24', 10);

// Plancher d'appareils : un client seul a souvent un téléphone ET une tablette.
// Sans ce plancher, la réception passerait son temps à débloquer des codes.
const MIN_DEVICES = 2;

// ── Format du code ────────────────────────────────────────────────────
// Génère un code aléatoire cryptographiquement sûr.
function randomCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

// Normalise une saisie client : casse, espaces et tirets de présentation
// (« k7f2-qm » → « K7F2QM »). Retourne null si un caractère hors alphabet
// subsiste : les codes générés ne contiennent ni 0/O ni 1/I/L, une telle
// saisie est donc nécessairement erronée.
function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

// Découpe pour l'affichage : « K7F2QM » → « K7F-2QM ».
function formatCode(code) {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

// Tire un code libre pour cet hôtel. L'unicité est garantie par l'index
// (hotel_id, code) ; cette boucle évite simplement de s'appuyer sur l'erreur.
async function generateUniqueCode(hotelId, maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomCode();
    const [[clash]] = await db.query(
      'SELECT id FROM guest_codes WHERE hotel_id = ? AND code = ? LIMIT 1',
      [hotelId, code]
    );
    if (!clash) return code;
  }
  throw new Error('Impossible de générer un code unique après plusieurs tentatives');
}

// ── Validité ──────────────────────────────────────────────────────────
// Fin d'accès réelle = heure de départ + marge de courtoisie.
function effectiveUntil(row) {
  const until = new Date(row.valid_until);
  const grace = row.grace_hours ?? DEFAULT_GRACE_HOURS;
  return new Date(until.getTime() + grace * 3_600_000);
}

// Statut lisible d'un code, unique source de vérité pour l'API comme pour le
// back-office : 'revoked' | 'upcoming' | 'active' | 'grace' | 'expired'.
function computeStatus(row, now = new Date()) {
  if (row.revoked_at) return 'revoked';
  if (now < new Date(row.valid_from)) return 'upcoming';
  if (now <= new Date(row.valid_until)) return 'active';
  if (now <= effectiveUntil(row)) return 'grace';
  return 'expired';
}

// Un code est utilisable pendant le séjour et pendant la marge de courtoisie.
function isUsable(status) {
  return status === 'active' || status === 'grace';
}

// ── Jetons de session ─────────────────────────────────────────────────
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Le JWT expire à la fin d'accès réelle : un jeton volé ne survit pas au séjour,
// même si la ligne de session disparaît de la base.
function signGuestToken({ hotelId, codeId, sessionId }, expiresAt) {
  const ttlSeconds = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return jwt.sign(
    { scope: 'guest', hotel_id: hotelId, code_id: codeId, session_id: sessionId },
    JWT_SECRET,
    { expiresIn: ttlSeconds }
  );
}

// Vérifie un jeton visiteur de bout en bout : signature, portée, session non
// révoquée, code non révoqué et toujours dans sa fenêtre de validité.
// Retourne { hotelId, codeId, sessionId, code } ou null.
async function verifyGuestToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (payload.scope !== 'guest' || !payload.session_id) return null;

  const [[row]] = await db.query(
    `SELECT s.id AS session_id, s.revoked_at AS session_revoked_at,
            c.id AS code_id, c.hotel_id, c.code, c.room_number, c.guest_name,
            c.valid_from, c.valid_until, c.grace_hours, c.revoked_at
     FROM guest_sessions s
     JOIN guest_codes c ON c.id = s.code_id
     WHERE s.id = ? AND s.token_hash = ?
     LIMIT 1`,
    [payload.session_id, hashToken(token)]
  );

  if (!row || row.session_revoked_at) return null;
  if (!isUsable(computeStatus(row))) return null;

  return {
    hotelId:   row.hotel_id,
    codeId:    row.code_id,
    sessionId: row.session_id,
    stay:      row,
  };
}

// Signal de vie discret : alimente « dernière utilisation » du back-office.
// Volontairement non bloquant — une écriture ratée ne doit jamais faire
// échouer une requête de contenu.
function touchSession(sessionId) {
  db.query('UPDATE guest_sessions SET last_seen_at = NOW() WHERE id = ?', [sessionId])
    .catch(() => {});
}

module.exports = {
  ALPHABET,
  CODE_LENGTH,
  DEFAULT_GRACE_HOURS,
  MIN_DEVICES,
  normalizeCode,
  formatCode,
  generateUniqueCode,
  effectiveUntil,
  computeStatus,
  isUsable,
  hashToken,
  signGuestToken,
  verifyGuestToken,
  touchSession,
};
