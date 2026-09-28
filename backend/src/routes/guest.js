// Routes publiques visiteur — accès au menu front-office par code de séjour
//
// POST /api/guest/redeem  — échange un code contre un jeton de session (consomme un slot d'appareil)
// GET  /api/guest/me      — infos « Mon séjour » (bienvenue nominative, Wi-Fi, check-out) — protégé
// POST /api/guest/qr      — valide un code et retourne l'URL à encoder en QR, SANS créer de session
//
// La distinction redeem / qr est volontaire : l'écran de la borne et celui de la
// réception affichent un QR pour que le client le scanne, sans que la borne ne
// consomme un des appareils autorisés du séjour. Ce point de terminaison ne
// renvoie donc AUCUNE donnée nominative : un inconnu qui essaie des codes au
// hasard dans le hall ne doit pas récolter l'identité des clients.
const express = require('express');
const crypto  = require('crypto');
const db      = require('../services/db');
const guest   = require('../services/guestAccess');
const guestAuth = require('../middleware/guestAuth');

const router = express.Router();

// ── Budget d'échecs contre la force brute ─────────────────────────
//
// Un limiteur de requêtes classique ne convient pas ici : il refuse l'appel avant
// de savoir si le code est bon, et son compteur est de fait partagé par tous les
// clients (req.ip vaut l'adresse de nginx sans TRUST_PROXY, et les clients d'un
// hôtel sortent de toute façon sur une seule IP publique). Quelques saisies
// erronées bloquaient alors les clients porteurs d'un code valide.
//
// Ici le code est d'abord validé : un code juste est TOUJOURS servi, quel que soit
// le nombre d'échecs alentour. Seuls les échecs consomment le budget, et c'est
// l'attaquant — qui ne soumet que des codes faux — qui heurte le mur.
//
// 20 échecs/minute face à 30^6 combinaisons (≈ 729 millions) rendent l'essai
// exhaustif hors de portée. Le plafond de volume, lui, reste le limiteur global.
const FAILURE_BUDGET   = parseInt(process.env.GUEST_FAILURE_BUDGET || '20', 10);
const FAILURE_WINDOW_MS = 60_000;
const failures = new Map();   // clé → { count, resetAt }

function failureKey(req) {
  // Sans TRUST_PROXY, req.ip est l'adresse du proxy : le budget devient commun.
  // C'est acceptable — il ne pénalise que les saisies fausses, jamais un code juste.
  return req.ip || 'global';
}

function overBudget(req) {
  const entry = failures.get(failureKey(req));
  return !!entry && entry.resetAt > Date.now() && entry.count >= FAILURE_BUDGET;
}

function noteFailure(req) {
  const key = failureKey(req);
  const now = Date.now();
  const entry = failures.get(key);

  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
  } else {
    entry.count += 1;
  }

  // Purge opportuniste : sans elle, la table enflerait indéfiniment sur un service
  // exposé. Le coût est amorti puisqu'elle ne s'exécute qu'au-delà de 500 clés.
  if (failures.size > 500) {
    for (const [k, v] of failures) {
      if (v.resetAt <= now) failures.delete(k);
    }
  }
}

// Messages d'erreur par cause, pour que le front sache quoi afficher :
// l'expiration ouvre l'écran « Séjour terminé » avec remerciement, pas une
// simple erreur de saisie.
const REASONS = {
  invalid:       { status: 404, error: 'Code introuvable ou incorrect' },
  upcoming:      { status: 403, error: "Ce code n'est pas encore actif" },
  expired:       { status: 403, error: 'Séjour terminé' },
  revoked:       { status: 403, error: "Ce code n'est plus valide" },
  device_limit:  { status: 403, error: "Nombre d'appareils autorisés atteint" },
  rate_limited:  { status: 429, error: 'Trop de tentatives — patientez une minute' },
};

// Répond à un échec de saisie. `req` est fourni pour les échecs qui relèvent d'une
// tentative de devinette : ceux-là consomment le budget, et au-delà la cause exacte
// est masquée derrière rate_limited — sinon la réponse deviendrait un oracle
// indiquant à l'attaquant quels codes existent.
function fail(res, reason, req = null) {
  if (req) {
    noteFailure(req);
    if (overBudget(req)) {
      const r = REASONS.rate_limited;
      return res.status(r.status).json({ reason: 'rate_limited', error: r.error });
    }
  }
  const r = REASONS[reason] || REASONS.invalid;
  return res.status(r.status).json({ reason, error: r.error });
}

// Retrouve un code à partir du slug d'hôtel et du code saisi.
// Retourne { row } ou { reason } — jamais de détail permettant de distinguer
// un hôtel inexistant d'un code inexistant.
async function lookup(hotelSlug, rawCode) {
  const code = guest.normalizeCode(rawCode);
  if (!code || !hotelSlug) return { reason: 'invalid' };

  const [[row]] = await db.query(
    `SELECT c.*, h.slug AS hotel_slug
     FROM guest_codes c
     JOIN hotels h ON h.id = c.hotel_id
     WHERE h.slug = ? AND h.is_active = 1 AND c.code = ?
     LIMIT 1`,
    [String(hotelSlug).trim(), code]
  );

  if (!row) return { reason: 'invalid' };

  const status = guest.computeStatus(row);
  if (!guest.isUsable(status)) {
    return { reason: status === 'upcoming' ? 'upcoming' : status === 'revoked' ? 'revoked' : 'expired' };
  }

  return { row, status };
}

// ── POST /api/guest/redeem ────────────────────────────────────────────
// Body : { hotel_slug, code, fingerprint? }
router.post('/redeem', async (req, res) => {
  const { hotel_slug, code, fingerprint } = req.body || {};

  try {
    const found = await lookup(hotel_slug, code);
    if (found.reason) return fail(res, found.reason, req);

    const row       = found.row;
    const expiresAt = guest.effectiveUntil(row);
    const fp        = fingerprint ? String(fingerprint).slice(0, 64) : null;

    // Le comptage des appareils et l'insertion doivent être atomiques : deux
    // téléphones qui scannent le QR en même temps ne doivent pas dépasser
    // le quota tous les deux en passant le test avant l'écriture de l'autre.
    const conn = await db.getConnection();
    let sessionId;
    try {
      await conn.beginTransaction();

      // Même appareil qu'une session existante : on la réutilise plutôt que
      // d'entamer un nouveau slot (rechargement de page, navigation privée mise
      // à part). Le jeton est régénéré à cette occasion.
      //
      // La recherche ignore volontairement revoked_at : l'index unique
      // (code_id, fingerprint) interdit un second enregistrement pour le même
      // appareil, une session révoquée doit donc être réveillée et non doublée.
      // Cas réels : un code révoqué puis prolongé, ou un appareil détaché depuis
      // le back-office dont le client ressaisit son code.
      let existing = null;
      if (fp) {
        const [[hit]] = await conn.query(
          `SELECT id, revoked_at FROM guest_sessions
           WHERE code_id = ? AND fingerprint = ?
           FOR UPDATE`,
          [row.id, fp]
        );
        existing = hit || null;
      }

      // Une session révoquée ne compte plus dans le quota : la réveiller consomme
      // donc un slot, exactement comme un appareil neuf.
      if (!existing || existing.revoked_at) {
        const [[{ cnt }]] = await conn.query(
          'SELECT COUNT(*) AS cnt FROM guest_sessions WHERE code_id = ? AND revoked_at IS NULL FOR UPDATE',
          [row.id]
        );
        if (cnt >= row.max_devices) {
          await conn.rollback();
          return fail(res, 'device_limit');
        }
      }

      if (existing) {
        sessionId = existing.id;
        if (existing.revoked_at) {
          await conn.query('UPDATE guest_sessions SET revoked_at = NULL WHERE id = ?', [existing.id]);
        }
      } else {
        // token_hash est provisoire : l'id de session entre dans le JWT, donc le
        // jeton définitif ne peut être signé qu'après l'insertion.
        const [ins] = await conn.query(
          `INSERT INTO guest_sessions (code_id, token_hash, fingerprint, user_agent, ip_first, last_seen_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            row.id,
            crypto.randomBytes(32).toString('hex'),
            fp,
            (req.headers['user-agent'] || '').slice(0, 255) || null,
            req.ip || null,
          ]
        );
        sessionId = ins.insertId;
      }

      const token = guest.signGuestToken(
        { hotelId: row.hotel_id, codeId: row.id, sessionId },
        expiresAt
      );

      await conn.query(
        'UPDATE guest_sessions SET token_hash = ?, last_seen_at = NOW() WHERE id = ?',
        [guest.hashToken(token), sessionId]
      );

      await conn.commit();

      return res.json({
        guest_token: token,
        hotel_slug:  row.hotel_slug,
        expires_at:  expiresAt.toISOString(),
        stay: {
          room_number: row.room_number,
          guest_name:  row.guest_name,
          valid_from:  row.valid_from,
          valid_until: row.valid_until,
        },
      });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[guest/redeem]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/guest/qr ────────────────────────────────────────────────
// Body : { hotel_slug, code }
// Valide le code et rend l'URL à encoder. Aucune session créée, aucune donnée
// nominative renvoyée : cet appel est exposé sur l'écran public de la borne.
router.post('/qr', async (req, res) => {
  const { hotel_slug, code } = req.body || {};

  try {
    const found = await lookup(hotel_slug, code);
    if (found.reason) return fail(res, found.reason, req);

    const row = found.row;
    return res.json({
      path:        `/${row.hotel_slug}/visiteur?c=${row.code}`,
      valid_until: guest.effectiveUntil(row).toISOString(),
    });
  } catch (err) {
    console.error('[guest/qr]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /api/guest/me ─────────────────────────────────────────────────
// Carte « Mon séjour » : les champs sensibles retirés de /api/kiosk/:slug/config
// (Wi-Fi, horaires, message de bienvenue) ne sont servis qu'ici.
router.get('/me', guestAuth, async (req, res) => {
  try {
    const stay = req.guest.stay;

    const [[settings]] = await db.query(
      `SELECT hs.wifi_name, hs.wifi_password, hs.checkin_time, hs.checkout_time,
              hs.welcome_message_fr, hs.welcome_message_en, hs.welcome_message_de,
              hs.welcome_message_es, hs.welcome_message_pt, hs.welcome_message_ar,
              hs.welcome_message_zh, hs.welcome_message_ja, hs.welcome_message_ru
       FROM hotel_settings hs
       WHERE hs.hotel_id = ?
       LIMIT 1`,
      [req.guest.hotelId]
    );

    guest.touchSession(req.guest.sessionId);

    return res.json({
      stay: {
        guest_name:   stay.guest_name,
        room_number:  stay.room_number,
        valid_from:   stay.valid_from,
        valid_until:  stay.valid_until,
        access_until: guest.effectiveUntil(stay).toISOString(),
        status:       guest.computeStatus(stay),
      },
      settings: settings || {},
    });
  } catch (err) {
    console.error('[guest/me]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
