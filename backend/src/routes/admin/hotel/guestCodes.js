// Gestion des codes d'accès client — hotel_admin, hotel_staff (réception) et super_admin
//
// GET    /api/admin/hotel/guest-codes              — liste des codes de l'hôtel (+ statut, appareils)
// GET    /api/admin/hotel/guest-codes/:id          — détail d'un code + appareils rattachés
// POST   /api/admin/hotel/guest-codes              — créer un code
// POST   /api/admin/hotel/guest-codes/bulk         — créer plusieurs codes (arrivées du jour)
// PUT    /api/admin/hotel/guest-codes/:id          — prolonger / ajuster (extension de séjour)
// PUT    /api/admin/hotel/guest-codes/:id/revoke   — révoquer (départ anticipé, code perdu)
// DELETE /api/admin/hotel/guest-codes/:id/sessions/:sessionId — détacher un appareil
const express = require('express');
const db      = require('../../../services/db');
const guest   = require('../../../services/guestAccess');

const router = express.Router();

// Super-admin peut passer ?hotel_id=X pour gérer n'importe quel hôtel
function resolveHotelId(req) {
  if (req.user.role === 'super_admin' && req.query.hotel_id) {
    return parseInt(req.query.hotel_id, 10);
  }
  return req.hotelId;
}

async function auditLog(req, action, entityId, oldValue, newValue) {
  await db.query(
    `INSERT INTO audit_log (user_id, user_role, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES (?, ?, ?, 'guest_code', ?, ?, ?, ?)`,
    [
      req.user.id, req.user.role, action, entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      req.ip || null,
    ]
  ).catch(() => {});
}

// Bornes issues des types de colonnes (voir migration 015) : les dépasser
// produirait une erreur MySQL, donc une 500 au lieu d'un refus explicite.
const MAX_OCCUPANTS   = 99;     // TINYINT UNSIGNED, et 99 occupants n'existent pas
const MAX_DEVICES      = 99;    // idem
const MAX_GRACE_HOURS  = 8760;  // SMALLINT UNSIGNED — un an de courtoisie suffit

// Accepte 'AAAA-MM-JJ' (borné à la journée) comme 'AAAA-MM-JJTHH:mm'.
// Une date d'arrivée commence à 00h00 — le client qui arrive tôt n'attend pas —
// et une date de départ court jusqu'à 23h59, la courtoisie s'ajoutant par-dessus.
function parseBound(value, edge) {
  if (!value) return null;
  // Une valeur relue en base arrive en objet Date (mysql2) : la repasser par une
  // chaîne marcherait, mais dépendre du format de Date.toString() est fragile.
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const iso = dateOnly
    ? `${raw}T${edge === 'end' ? '23:59:59' : '00:00:00'}`
    : raw;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Format MySQL DATETIME ('AAAA-MM-JJ HH:mm:ss') en heure locale du serveur.
function toSql(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Début de la journée en cours : une arrivée « aujourd'hui » reste valide même
// saisie à 18 h, alors qu'une arrivée hier n'a plus de sens à la création.
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameInstant(a, b) {
  return a && b && a.getTime() === b.getTime();
}

/**
 * Normalise et valide une demande de création ou de modification.
 * Retourne { error } ou { values }.
 *
 * `existing` est la ligne en base lors d'une modification. Les règles de dates en
 * dépendent : tant que le séjour n'a pas commencé, la réception ajuste librement
 * l'arrivée (client annoncé plus tôt ou plus tard) ; une fois commencé, l'arrivée
 * est un fait, seule la fin bouge — c'est la prolongation.
 */
function buildPayload(body, { existing = null } = {}) {
  const from  = parseBound(body.valid_from,  'start');
  const until = parseBound(body.valid_until, 'end');

  if (!from || !until)     return { error: 'valid_from et valid_until requis (AAAA-MM-JJ)' };
  if (until <= from)       return { error: 'La date de départ doit suivre la date d\'arrivée' };

  const now     = new Date();
  const today   = startOfToday();
  const started = existing ? parseBound(existing.valid_from, 'start') <= now : false;

  if (started) {
    // Le séjour court déjà : déplacer son début réécrirait l'historique d'accès.
    const before = parseBound(existing.valid_from, 'start');
    if (!sameInstant(from, before)) {
      return { error: "Le séjour a commencé : la date d'arrivée n'est plus modifiable" };
    }
  } else if (from < today) {
    return { error: "La date d'arrivée ne peut pas être antérieure à aujourd'hui" };
  }

  // Une fin déjà passée ne produit qu'un code mort. Pour couper un accès, la
  // révocation est le geste prévu — explicite et réversible.
  if (until <= now) {
    return { error: 'La date de départ est déjà passée : choisissez une date à venir' };
  }

  // Les bornes hautes ne sont pas cosmétiques : occupants et max_devices tiennent
  // dans un TINYINT UNSIGNED (255) et grace_hours dans un SMALLINT UNSIGNED (65535).
  // Sans ces plafonds, une saisie aberrante remontait en « Erreur serveur » 500
  // depuis MySQL au lieu d'un message compréhensible.
  const clamp = (value, min, max, fallback) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
  };

  const occupants = clamp(body.occupants, 1, MAX_OCCUPANTS, 1);
  // Plancher à 2 appareils : téléphone + tablette pour un client seul. En l'absence
  // de valeur explicite, on part du nombre d'occupants.
  const maxDevices = clamp(
    body.max_devices, guest.MIN_DEVICES, MAX_DEVICES,
    Math.max(guest.MIN_DEVICES, occupants)
  );
  // Un séjour d'une seule journée (arrivée et départ le même jour) n'a pas à
  // traîner la courtoisie de 24 h prévue pour un départ au matin : elle doublerait
  // la durée d'accès d'un client de passage. La réception peut toujours en fixer
  // une explicitement, ici comme depuis le modal de modification.
  const sameDay = from.getFullYear() === until.getFullYear()
               && from.getMonth()    === until.getMonth()
               && from.getDate()     === until.getDate();

  const graceHours = body.grace_hours === undefined
    ? (sameDay ? 0 : guest.DEFAULT_GRACE_HOURS)
    : clamp(body.grace_hours, 0, MAX_GRACE_HOURS, guest.DEFAULT_GRACE_HOURS);

  return {
    values: {
      room_number: body.room_number ? String(body.room_number).trim().slice(0, 20)  : null,
      guest_name:  body.guest_name  ? String(body.guest_name).trim().slice(0, 120) : null,
      occupants,
      max_devices: maxDevices,
      valid_from:  toSql(from),
      valid_until: toSql(until),
      grace_hours: graceHours,
    },
  };
}

// Insère un code. `created_by` porte une clé étrangère vers admin_users : si le
// compte a été supprimé pendant que sa session restait ouverte (JWT encore valide),
// MySQL refusait la ligne et la réception se voyait renvoyer une erreur 500. Le code
// du client importe plus que son attribution : on réessaie sans auteur.
async function insertCode(hotelId, code, values, userId) {
  const params = createdBy => [
    hotelId, code, values.room_number, values.guest_name, values.occupants,
    values.max_devices, values.valid_from, values.valid_until,
    values.grace_hours, createdBy,
  ];
  const sql = `INSERT INTO guest_codes
       (hotel_id, code, room_number, guest_name, occupants, max_devices,
        valid_from, valid_until, grace_hours, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  try {
    const [ins] = await db.query(sql, params(userId));
    return ins.insertId;
  } catch (err) {
    if (err.code !== 'ER_NO_REFERENCED_ROW_2') throw err;
    console.warn(`[hotel/guest-codes] auteur ${userId} introuvable — code créé sans attribution`);
    const [ins] = await db.query(sql, params(null));
    return ins.insertId;
  }
}

// Enrichit une ligne avec son statut et sa fin d'accès réelle.
function decorate(row) {
  return {
    ...row,
    code_formatted: guest.formatCode(row.code),
    status:         guest.computeStatus(row),
    access_until:   guest.effectiveUntil(row).toISOString(),
  };
}

// ── GET / ─────────────────────────────────────────────────────────────
// ?status=active|upcoming|grace|expired|revoked  ?q=<chambre ou nom>
router.get('/', async (req, res) => {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

  try {
    const params = [hotelId];
    let where = 'c.hotel_id = ?';

    if (req.query.q) {
      where += ' AND (c.room_number LIKE ? OR c.guest_name LIKE ? OR c.code = ?)';
      const like = `%${req.query.q.trim()}%`;
      params.push(like, like, guest.normalizeCode(req.query.q) || '');
    }

    const [rows] = await db.query(
      `SELECT c.*,
              COUNT(s.id)        AS devices_used,
              MAX(s.last_seen_at) AS last_used_at
       FROM guest_codes c
       LEFT JOIN guest_sessions s ON s.code_id = c.id AND s.revoked_at IS NULL
       WHERE ${where}
       GROUP BY c.id
       ORDER BY c.valid_from DESC, c.id DESC
       LIMIT 500`,
      params
    );

    let out = rows.map(decorate);
    // Le statut est calculé, pas stocké : le filtre s'applique donc après coup.
    if (req.query.status) out = out.filter(r => r.status === req.query.status);

    return res.json(out);
  } catch (err) {
    console.error('[hotel/guest-codes GET]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const hotelId = resolveHotelId(req);

  try {
    const [[row]] = await db.query(
      'SELECT * FROM guest_codes WHERE id = ? AND hotel_id = ?',
      [req.params.id, hotelId]
    );
    if (!row) return res.status(404).json({ error: 'Code introuvable' });

    const [sessions] = await db.query(
      `SELECT id, fingerprint, user_agent, ip_first, first_seen_at, last_seen_at, revoked_at
       FROM guest_sessions WHERE code_id = ? ORDER BY first_seen_at DESC`,
      [row.id]
    );

    return res.json({ ...decorate(row), sessions });
  } catch (err) {
    console.error('[hotel/guest-codes/:id GET]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST / ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

  const { error, values } = buildPayload(req.body || {});
  if (error) return res.status(400).json({ error });

  try {
    const code = await guest.generateUniqueCode(hotelId);
    const id   = await insertCode(hotelId, code, values, req.user.id);

    await auditLog(req, 'create', id, null, { code, ...values });

    const [[row]] = await db.query('SELECT * FROM guest_codes WHERE id = ?', [id]);
    return res.status(201).json({ ...decorate(row), devices_used: 0, last_used_at: null });
  } catch (err) {
    console.error('[hotel/guest-codes POST]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /bulk ────────────────────────────────────────────────────────
// Body : { items: [ { room_number, guest_name, occupants, valid_from, valid_until } ] }
// Prévu pour la préparation des arrivées du jour. Les lignes invalides sont
// rapportées une par une : une erreur de saisie sur la chambre 12 ne doit pas
// faire perdre les 40 autres codes déjà saisis.
router.post('/bulk', async (req, res) => {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ error: 'hotel_id manquant' });

  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items || !items.length) return res.status(400).json({ error: 'items requis' });
  if (items.length > 200)      return res.status(400).json({ error: 'Maximum 200 codes par lot' });

  const created = [];
  const rejected = [];

  for (const [index, item] of items.entries()) {
    const { error, values } = buildPayload(item || {});
    if (error) {
      rejected.push({ index, room_number: item?.room_number ?? null, error });
      continue;
    }
    try {
      const code = await guest.generateUniqueCode(hotelId);
      const id   = await insertCode(hotelId, code, values, req.user.id);
      created.push({ id, code, code_formatted: guest.formatCode(code), ...values });
    } catch (err) {
      rejected.push({ index, room_number: item?.room_number ?? null, error: err.message });
    }
  }

  await auditLog(req, 'create_bulk', null, null, {
    created: created.length, rejected: rejected.length,
  });

  return res.status(created.length ? 201 : 400).json({ created, rejected });
});

// ── PUT /:id ──────────────────────────────────────────────────────────
// Prolongation de séjour et ajustements. Un code révoqué est réactivé si on lui
// redonne une fenêtre valide : c'est le cas d'un client qui prolonge après coup.
router.put('/:id', async (req, res) => {
  const hotelId = resolveHotelId(req);

  try {
    const [[before]] = await db.query(
      'SELECT * FROM guest_codes WHERE id = ? AND hotel_id = ?',
      [req.params.id, hotelId]
    );
    if (!before) return res.status(404).json({ error: 'Code introuvable' });

    const { error, values } = buildPayload({
      room_number: req.body.room_number ?? before.room_number,
      guest_name:  req.body.guest_name  ?? before.guest_name,
      occupants:   req.body.occupants   ?? before.occupants,
      max_devices: req.body.max_devices ?? before.max_devices,
      valid_from:  req.body.valid_from  ?? before.valid_from,
      valid_until: req.body.valid_until ?? before.valid_until,
      grace_hours: req.body.grace_hours ?? before.grace_hours,
    }, { existing: before });
    if (error) return res.status(400).json({ error });

    const reactivate = req.body.reactivate === true;

    await db.query(
      `UPDATE guest_codes
       SET room_number = ?, guest_name = ?, occupants = ?, max_devices = ?,
           valid_from = ?, valid_until = ?, grace_hours = ?
           ${reactivate ? ', revoked_at = NULL' : ''}
       WHERE id = ?`,
      [
        values.room_number, values.guest_name, values.occupants, values.max_devices,
        values.valid_from, values.valid_until, values.grace_hours, before.id,
      ]
    );

    await auditLog(req, 'update', before.id, before, values);

    const [[row]] = await db.query('SELECT * FROM guest_codes WHERE id = ?', [before.id]);
    return res.json(decorate(row));
  } catch (err) {
    console.error('[hotel/guest-codes PUT]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /:id/revoke ───────────────────────────────────────────────────
// Coupe l'accès immédiatement : le code ET toutes ses sessions. Les jetons déjà
// émis deviennent inopérants au prochain appel, sans attendre leur expiration.
router.put('/:id/revoke', async (req, res) => {
  const hotelId = resolveHotelId(req);

  try {
    const [[before]] = await db.query(
      'SELECT * FROM guest_codes WHERE id = ? AND hotel_id = ?',
      [req.params.id, hotelId]
    );
    if (!before) return res.status(404).json({ error: 'Code introuvable' });

    await db.query('UPDATE guest_codes SET revoked_at = NOW() WHERE id = ?', [before.id]);
    await db.query(
      'UPDATE guest_sessions SET revoked_at = NOW() WHERE code_id = ? AND revoked_at IS NULL',
      [before.id]
    );

    await auditLog(req, 'revoke', before.id, { revoked_at: before.revoked_at }, { revoked_at: new Date() });

    const [[row]] = await db.query('SELECT * FROM guest_codes WHERE id = ?', [before.id]);
    return res.json(decorate(row));
  } catch (err) {
    console.error('[hotel/guest-codes/revoke PUT]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /:id/sessions/:sessionId ───────────────────────────────────
// Détache un appareil sans toucher au code : le client qui a changé de téléphone
// libère ainsi un slot de son quota.
router.delete('/:id/sessions/:sessionId', async (req, res) => {
  const hotelId = resolveHotelId(req);

  try {
    const [[row]] = await db.query(
      `SELECT s.id
       FROM guest_sessions s
       JOIN guest_codes c ON c.id = s.code_id
       WHERE s.id = ? AND c.id = ? AND c.hotel_id = ?`,
      [req.params.sessionId, req.params.id, hotelId]
    );
    if (!row) return res.status(404).json({ error: 'Appareil introuvable' });

    await db.query('UPDATE guest_sessions SET revoked_at = NOW() WHERE id = ?', [row.id]);
    await auditLog(req, 'revoke_device', req.params.id, { session_id: row.id }, null);

    return res.json({ revoked: true });
  } catch (err) {
    console.error('[hotel/guest-codes/sessions DELETE]', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
