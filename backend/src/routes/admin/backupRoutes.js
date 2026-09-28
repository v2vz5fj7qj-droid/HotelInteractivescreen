/**
 * Routes de sauvegarde / restauration — fabrique partagée.
 *
 * Deux montages, un seul code :
 *   variant 'hotel' → /api/admin/hotel/backup  (périmètre « hotel » imposé,
 *                     destination verrouillée sur l'hôtel de l'utilisateur)
 *   variant 'super' → /api/admin/super/backup  (tous les périmètres, choix de
 *                     l'hôtel de destination, création d'hôtels autorisée)
 *
 * Endpoints :
 *   GET    /scopes                    périmètres disponibles + hôtels
 *   GET    /export                    télécharge une archive
 *   POST   /inspect                   essai à blanc sur un fichier envoyé
 *   POST   /import                    applique un fichier envoyé
 *   GET    /snapshots                 instantanés conservés sur le serveur
 *   POST   /snapshots                 crée un instantané
 *   GET    /snapshots/:id/download    télécharge un instantané
 *   POST   /snapshots/:id/inspect     essai à blanc sur un instantané
 *   POST   /snapshots/:id/restore     restaure un instantané
 *   DELETE /snapshots/:id             supprime un instantané
 */
const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('../../services/db');
const backup  = require('../../services/configBackup');

// 150 Mo : une archive d'instance complète embarque tous les médias. Le fichier
// transite par le disque et non par la mémoire — un import ne doit pas pouvoir
// faire tomber l'API pour cause de RAM.
const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;
const TMP_DIR = path.join(os.tmpdir(), 'connectbe-import');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      cb(null, TMP_DIR);
    },
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.zip`),
  }),
  limits: { fileSize: MAX_ARCHIVE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.zip$/i.test(file.originalname) ||
      ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(file.mimetype);
    cb(ok ? null : new Error('Archive .zip attendue'), ok);
  },
});

const discard = file => { if (file?.path) fs.promises.unlink(file.path).catch(() => {}); };

async function audit(req, action, detail) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, user_role, action, entity_type, entity_id, new_value, ip_address)
       VALUES (?, ?, ?, 'config_backup', NULL, ?, ?)`,
      [req.user?.id || null, req.user?.role || null, action, JSON.stringify(detail), req.ip || null]
    );
  } catch (err) {
    // Le journal ne doit jamais faire échouer l'opération elle-même.
    console.error('[backup audit]', err.message);
  }
}

const actorOf = req => req.user?.email || null;

function sendArchive(res, filename, buffer) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

function fail(res, err, tag) {
  const status = err.status || 500;
  if (status === 500) console.error(`[backup ${tag}]`, err);
  res.status(status).json({ error: status === 500 ? 'Erreur serveur' : err.message });
}

module.exports = function buildBackupRouter({ variant }) {
  const isSuper = variant === 'super';
  const router  = express.Router();

  // Hôtel visé par une opération de périmètre « hotel ».
  // Un super-admin peut cibler n'importe quel hôtel ; un admin d'hôtel est
  // borné au sien, quoi qu'il envoie dans la requête.
  function scopedHotelId(req, raw) {
    if (req.user.role === 'super_admin') {
      const id = parseInt(raw ?? req.hotelId);
      return Number.isInteger(id) ? id : null;
    }
    return req.hotelId || null;
  }

  function requestedScope(req, raw) {
    if (!isSuper) return 'hotel';
    const scope = raw || 'hotel';
    if (!backup.SCOPES.includes(scope)) {
      throw Object.assign(new Error(`Périmètre inconnu — ${scope}`), { status: 400 });
    }
    return scope;
  }

  // ── Périmètres disponibles ───────────────────────────────────────────────
  router.get('/scopes', async (req, res) => {
    try {
      const scopes = (isSuper ? backup.SCOPES : ['hotel'])
        .map(s => ({ value: s, label: backup.SCOPE_LABELS[s] }));
      let hotels = [];
      if (isSuper) {
        const [rows] = await db.query('SELECT id, slug, nom FROM hotels ORDER BY nom');
        hotels = rows;
      } else if (req.hotelId) {
        const [rows] = await db.query('SELECT id, slug, nom FROM hotels WHERE id = ?', [req.hotelId]);
        hotels = rows;
      }
      res.json({ scopes, hotels, max_archive_bytes: MAX_ARCHIVE_BYTES, format: backup.ARCHIVE_FORMAT });
    } catch (err) { fail(res, err, 'scopes'); }
  });

  // ── Export ───────────────────────────────────────────────────────────────
  router.get('/export', async (req, res) => {
    try {
      const scope = requestedScope(req, req.query.scope);
      let hotelIds = [];
      if (scope === 'hotel') {
        const id = scopedHotelId(req, req.query.hotel_id);
        if (!id) return res.status(400).json({ error: 'Aucun hôtel ciblé' });
        hotelIds = [id];
      }
      const { buffer, filename, manifest } = await backup.buildArchive({
        scope, hotelIds, actor: actorOf(req),
      });
      await audit(req, 'export', { scope, hotels: manifest.hotels.map(h => h.slug), rows: manifest.counts });
      sendArchive(res, filename, buffer);
    } catch (err) { fail(res, err, 'export'); }
  });

  // ── Essai à blanc sur un fichier envoyé ──────────────────────────────────
  router.post('/inspect', upload.single('archive'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    try {
      const report = await backup.inspectArchive(req.file.path);
      if (!isSuper && report.manifest.scope !== 'hotel') {
        return res.status(403).json({
          error: "Cette archive couvre plus qu'un établissement : seul un super-admin peut l'importer",
        });
      }
      res.json(report);
    } catch (err) { fail(res, err, 'inspect'); }
    finally { discard(req.file); }
  });

  // ── Import d'un fichier envoyé ───────────────────────────────────────────
  router.post('/import', upload.single('archive'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    try {
      const report = await runImport(req, req.file.path);
      res.json(report);
    } catch (err) { fail(res, err, 'import'); }
    finally { discard(req.file); }
  });

  // Import commun au fichier envoyé et à l'instantané serveur.
  async function runImport(req, source) {
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const info = await backup.inspectArchive(source);
    const scope = info.manifest.scope;

    if (!isSuper && scope !== 'hotel') {
      throw Object.assign(new Error("Cette archive couvre plus qu'un établissement : seul un super-admin peut l'importer"), { status: 403 });
    }

    let targetHotelId = null;
    if (scope === 'hotel') {
      targetHotelId = scopedHotelId(req, req.body?.target_hotel_id);
      if (!targetHotelId) throw Object.assign(new Error('Hôtel de destination requis'), { status: 400 });
    }

    // Filet de sécurité : avant toute écriture, on met de côté l'état actuel du
    // périmètre concerné. C'est ce qui rend un import annulable.
    let safety = null;
    try {
      safety = await backup.createSnapshot({
        scope,
        hotelIds: targetHotelId ? [targetHotelId] : [],
        actor: actorOf(req),
        reason: 'avant-import',
      });
    } catch (err) {
      throw Object.assign(
        new Error(`Import annulé : impossible de créer l'instantané de sécurité (${err.message})`),
        { status: 500 }
      );
    }

    const report = await backup.applyArchive(source, {
      mode, targetHotelId,
      createMissingHotels: isSuper && req.body?.create_missing_hotels === 'true',
      actor: actorOf(req),
    });
    report.safety_snapshot = safety.id;

    await audit(req, `import:${mode}`, {
      scope, target_hotel_id: targetHotelId, safety_snapshot: safety.id, totals: report.totals,
    });
    return report;
  }

  // ── Instantanés conservés sur le serveur ─────────────────────────────────
  router.get('/snapshots', (req, res) => {
    try {
      const list = isSuper
        ? backup.listSnapshots()
        : backup.listSnapshots({ hotelId: req.hotelId, scopes: ['hotel'] });
      res.json(list);
    } catch (err) { fail(res, err, 'snapshots'); }
  });

  router.post('/snapshots', async (req, res) => {
    try {
      const scope = requestedScope(req, req.body?.scope);
      let hotelIds = [];
      if (scope === 'hotel') {
        const id = scopedHotelId(req, req.body?.hotel_id);
        if (!id) return res.status(400).json({ error: 'Aucun hôtel ciblé' });
        hotelIds = [id];
      }
      const snap = await backup.createSnapshot({ scope, hotelIds, actor: actorOf(req), reason: 'manuel' });
      await audit(req, 'snapshot', { scope, id: snap.id, size: snap.size });
      res.status(201).json({ id: snap.id, size: snap.size, created_at: snap.manifest.created_at });
    } catch (err) { fail(res, err, 'snapshot'); }
  });

  // Vérifie que l'instantané existe et que l'utilisateur a le droit d'y toucher.
  function resolveSnapshot(req) {
    const abs = backup.snapshotPath(req.params.id);
    if (!abs || !fs.existsSync(abs)) {
      throw Object.assign(new Error('Instantané introuvable'), { status: 404 });
    }
    if (!isSuper) {
      const allowed = backup.listSnapshots({ hotelId: req.hotelId, scopes: ['hotel'] });
      if (!allowed.some(s => s.id === req.params.id)) {
        throw Object.assign(new Error('Instantané introuvable'), { status: 404 });
      }
    }
    return abs;
  }

  router.get('/snapshots/:id/download', (req, res) => {
    try {
      const abs = resolveSnapshot(req);
      sendArchive(res, path.basename(abs), fs.readFileSync(abs));
    } catch (err) { fail(res, err, 'snapshot download'); }
  });

  router.post('/snapshots/:id/inspect', async (req, res) => {
    try {
      res.json(await backup.inspectArchive(resolveSnapshot(req)));
    } catch (err) { fail(res, err, 'snapshot inspect'); }
  });

  router.post('/snapshots/:id/restore', async (req, res) => {
    try {
      res.json(await runImport(req, resolveSnapshot(req)));
    } catch (err) { fail(res, err, 'snapshot restore'); }
  });

  router.delete('/snapshots/:id', async (req, res) => {
    try {
      resolveSnapshot(req);
      backup.deleteSnapshot(req.params.id);
      await audit(req, 'snapshot:delete', { id: req.params.id });
      res.json({ ok: true });
    } catch (err) { fail(res, err, 'snapshot delete'); }
  });

  // Erreurs de multer (fichier trop gros, mauvais type) : les renvoyer en clair
  // plutôt que de laisser le gestionnaire global répondre « Internal error ».
  router.use((err, req, res, _next) => {
    discard(req.file);
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Archive trop volumineuse (maximum ${Math.round(MAX_ARCHIVE_BYTES / 1024 / 1024)} Mo)` });
    }
    // multer renvoie ses messages en anglais : les traduire évite un
    // « Unexpected field » incompréhensible dans l'interface.
    const MULTER_FR = {
      LIMIT_UNEXPECTED_FILE: "Champ de fichier inattendu — l'archive doit être envoyée sous le nom « archive »",
      LIMIT_FILE_COUNT:      'Une seule archive à la fois',
    };
    res.status(400).json({ error: MULTER_FR[err?.code] || err?.message || 'Requête invalide' });
  });

  return router;
};
