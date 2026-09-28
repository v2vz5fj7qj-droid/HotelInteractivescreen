/**
 * configBackup — Sauvegarde et restauration de la configuration et du contenu.
 *
 * Trois opérations, toutes pilotées par les descripteurs de schema.js :
 *   buildArchive()   → fabrique une archive .zip téléchargeable
 *   inspectArchive() → lit une archive sans rien modifier (essai à blanc)
 *   applyArchive()   → réinjecte une archive dans la base
 *
 * Périmètres :
 *   hotel  — un établissement : sa configuration, son contenu, ses médias
 *   global — le catalogue partagé : lieux, agenda, infos utiles, catégories,
 *            localités météo, aéroports et leur planification de vols
 *   full   — global + tous les établissements
 *
 * Ce module ne remplace pas scripts/db-backup.sh, qui reste la sauvegarde
 * technique complète (schéma inclus) pour un sinistre serveur. Ici on
 * manipule des lignes logiques, ce qui permet en plus de cloner un hôtel
 * d'une instance vers une autre.
 */
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const db     = require('../db');
const {
  INSTANCE_KEY, VOLATILE_COLUMNS, TABLES, BY_NAME,
  selectSequence, insertSequence, purgeSequence,
} = require('./schema');

const ARCHIVE_FORMAT = 1;

// En conteneur, le code vit dans /app/src et les médias sont montés sur
// /uploads : ROOT vaut donc « / ». En local, ROOT est la racine du projet. Les
// deux variables restent surchargeables, car les instantanés doivent atterrir
// sur un volume monté — sinon ils disparaissent à la recréation du conteneur.
const ROOT           = path.resolve(__dirname, '../../../..');
const UPLOADS_ROOT   = path.resolve(process.env.UPLOADS_DIR       || path.join(ROOT, 'uploads'));
const SNAPSHOT_DIR   = path.resolve(process.env.CONFIG_BACKUP_DIR || path.join(ROOT, 'backups', 'config'));
const UPLOAD_PREFIX  = '/uploads/';
const MAX_SNAPSHOTS  = 20;

const SCOPES = ['hotel', 'global', 'full'];
const SCOPE_LABELS = {
  hotel:  "Un établissement (configuration, contenu et médias)",
  global: "Catalogue partagé (lieux, agenda, infos utiles, catégories, météo, vols)",
  full:   "Instance complète (catalogue partagé + tous les établissements)",
};

const ph = n => Array(n).fill('?').join(',');

// ── Métadonnées de colonnes ─────────────────────────────────────────────────
// L'archive est comparée au schéma réel à l'import : c'est ce qui permet de
// tolérer une dérive (colonne ajoutée ou retirée depuis l'export) au lieu de
// planter sur un « Unknown column ».
let columnCache = null;

async function columnMeta() {
  if (columnCache) return columnCache;
  const [rows] = await db.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()`
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.TABLE_NAME)) map.set(r.TABLE_NAME, new Map());
    map.get(r.TABLE_NAME).set(r.COLUMN_NAME, {
      dataType: r.DATA_TYPE,
      nullable: r.IS_NULLABLE === 'YES',
      hasDefault: r.COLUMN_DEFAULT !== null || r.EXTRA?.includes('auto_increment'),
    });
  }
  columnCache = map;
  return map;
}

function resetColumnCache() { columnCache = null; }

// ── Identité d'instance ─────────────────────────────────────────────────────
// Sert à distinguer « je restaure chez moi » (les chemins de médias sont
// conservés tels quels) de « j'importe une archive venue d'ailleurs » (les
// médias sont rangés à part pour ne rien écraser).
async function ensureInstanceId() {
  const [rows] = await db.query('SELECT config_value FROM theme_config WHERE config_key = ?', [INSTANCE_KEY]);
  if (rows[0]?.config_value) return rows[0].config_value;
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO theme_config (config_key, config_value, label) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE config_value = config_value`,
    [INSTANCE_KEY, id, "Identifiant d'instance (sauvegarde/restauration)"]
  );
  const [again] = await db.query('SELECT config_value FROM theme_config WHERE config_key = ?', [INSTANCE_KEY]);
  return again[0]?.config_value || id;
}

// ── Sérialisation ───────────────────────────────────────────────────────────
// mysql2 rend les DATE/DATETIME sous forme d'objets Date construits en heure
// locale. Les passer par JSON.stringify les convertirait en UTC et décalerait
// les dates d'événements d'un jour. On formate donc explicitement.
function pad(n) { return String(n).padStart(2, '0'); }

function serializeValue(value, dataType) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const d = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    if (dataType === 'date') return d;
    return `${d} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return value;
}

function deserializeValue(value, dataType) {
  if (value === null || value === undefined) return null;
  // Les colonnes JSON reviennent du fichier sous forme d'objet : mysql2 attend
  // une chaîne pour un INSERT.
  if (dataType === 'json' && typeof value === 'object') return JSON.stringify(value);
  return value;
}

// ── Chemins de médias ───────────────────────────────────────────────────────
function isUploadPath(v) {
  return typeof v === 'string' && v.startsWith(UPLOAD_PREFIX);
}

// Un nom d'entrée d'archive ne doit jamais sortir de uploads/. Sans cette
// vérification, une archive forgée écrirait n'importe où sur le disque
// (« zip slip »).
function safeUploadTarget(entryName) {
  if (!entryName.startsWith('uploads/')) return null;
  const rel = entryName.slice('uploads/'.length);
  if (!rel || rel.endsWith('/')) return null;
  const abs = path.resolve(UPLOADS_ROOT, rel);
  const root = UPLOADS_ROOT.endsWith(path.sep) ? UPLOADS_ROOT : UPLOADS_ROOT + path.sep;
  if (!abs.startsWith(root)) return null;
  return abs;
}

function sanitizeBasename(name) {
  return path.basename(name).replace(/[^\w.\-]/g, '_').slice(0, 120) || 'fichier';
}

// ── Export ──────────────────────────────────────────────────────────────────

async function resolveHotelIds(scope, hotelIds) {
  if (scope === 'global') return [];
  if (scope === 'full') {
    const [rows] = await db.query('SELECT id FROM hotels ORDER BY id');
    return rows.map(r => r.id);
  }
  if (!hotelIds?.length) throw new Error('Aucun hôtel sélectionné');
  return hotelIds;
}

/**
 * Fabrique l'archive. Retourne { buffer, filename, manifest }.
 */
async function buildArchive({ scope, hotelIds = [], actor = null }) {
  if (!SCOPES.includes(scope)) throw new Error(`Périmètre inconnu — ${scope}`);
  const meta      = await columnMeta();
  const instance  = await ensureInstanceId();
  const resolved  = await resolveHotelIds(scope, hotelIds);
  const ctx       = { scope, hotelIds: resolved, collected: new Map() };

  const data      = {};
  const counts    = {};
  const columns   = {};
  const redacted  = [];
  const uploadSet = new Set();

  for (const desc of selectSequence()) {
    const cols = meta.get(desc.name);
    if (!cols) continue; // table absente de cette base (schéma plus ancien)

    const query = desc.select(ctx);
    if (!query) { ctx.collected.set(desc.name, []); continue; }

    const [rows] = await db.query(query.sql, query.params);
    const kept   = desc.rowFilter ? rows.filter(desc.rowFilter) : rows;
    ctx.collected.set(desc.name, kept);

    const drop = new Set([...(desc.strip || []), ...VOLATILE_COLUMNS]);
    for (const c of (desc.strip || [])) {
      if (cols.has(c)) redacted.push(`${desc.name}.${c}`);
    }

    const out = kept.map(row => {
      const o = {};
      for (const [col, value] of Object.entries(row)) {
        if (drop.has(col)) continue;
        o[col] = serializeValue(value, cols.get(col)?.dataType);
        if (desc.uploads?.includes(col) && isUploadPath(o[col])) uploadSet.add(o[col]);
      }
      return o;
    });

    data[desc.name]    = out;
    counts[desc.name]  = out.length;
    columns[desc.name] = out.length ? Object.keys(out[0]) : [];
  }

  // ── Médias ────────────────────────────────────────────────────────────────
  const zip     = new AdmZip();
  const files   = [];
  const missing = [];
  let bytes = 0;

  for (const p of uploadSet) {
    const rel = p.slice(UPLOAD_PREFIX.length);
    const abs = safeUploadTarget(`uploads/${rel}`);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) { missing.push(p); continue; }
    const buf = fs.readFileSync(abs);
    zip.addFile(`uploads/${rel}`, buf);
    files.push(p);
    bytes += buf.length;
  }

  const hotels = resolved.length
    ? (ctx.collected.get('hotels') || []).map(h => ({ id: h.id, slug: h.slug, nom: h.nom }))
    : [];

  const manifest = {
    format:      ARCHIVE_FORMAT,
    app:         'connectbe',
    scope,
    created_at:  new Date().toISOString(),
    instance_id: instance,
    generated_by: actor || null,
    hotels,
    counts,
    columns,
    redacted:    [...new Set(redacted)],
    uploads:     { files: files.length, bytes, missing },
  };

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  zip.addFile('data.json',     Buffer.from(JSON.stringify(data), 'utf8'));

  const stamp = manifest.created_at.replace(/[-:T]/g, '').slice(0, 14);
  const tag   = scope === 'hotel' ? (hotels[0]?.slug || 'hotel') : scope;
  return { buffer: zip.toBuffer(), filename: `connectbe_${tag}_${stamp}.zip`, manifest };
}

// ── Lecture d'une archive ───────────────────────────────────────────────────

function openArchive(source) {
  let zip;
  try { zip = new AdmZip(source); }
  catch { throw Object.assign(new Error('Archive illisible — fichier .zip attendu'), { status: 400 }); }

  const readJson = name => {
    const entry = zip.getEntry(name);
    if (!entry) throw Object.assign(new Error(`Archive incomplète — ${name} manquant`), { status: 400 });
    try { return JSON.parse(zip.readAsText(entry)); }
    catch { throw Object.assign(new Error(`${name} illisible`), { status: 400 }); }
  };

  const manifest = readJson('manifest.json');
  if (manifest.app !== 'connectbe') {
    throw Object.assign(new Error("Cette archive ne provient pas de ConnectBé"), { status: 400 });
  }
  if (manifest.format > ARCHIVE_FORMAT) {
    throw Object.assign(new Error(
      `Archive au format ${manifest.format}, cette version n'en lit que ${ARCHIVE_FORMAT}. Mettez l'application à jour.`
    ), { status: 400 });
  }
  const data = readJson('data.json');
  return { zip, manifest, data };
}

/**
 * Essai à blanc : décrit ce que contient l'archive et ce que l'import ferait,
 * sans écrire une ligne.
 */
async function inspectArchive(source) {
  const { zip, manifest, data } = openArchive(source);
  const meta     = await columnMeta();
  const instance = await ensureInstanceId();
  const warnings = [];

  const tables = [];
  for (const desc of insertSequence()) {
    const rows = data[desc.name];
    if (!rows?.length) continue;
    const cols = meta.get(desc.name);
    if (!cols) {
      warnings.push(`Table « ${desc.name} » absente de cette base : ${rows.length} ligne(s) seront ignorées.`);
      tables.push({ table: desc.name, label: desc.label, rows: rows.length, skipped: true });
      continue;
    }
    const present = Object.keys(rows[0]);
    const unknown = present.filter(c => !cols.has(c));
    const missingRequired = [...cols.entries()]
      .filter(([c, m]) => !m.nullable && !m.hasDefault && !present.includes(c))
      .map(([c]) => c);
    if (unknown.length) {
      warnings.push(`« ${desc.name} » : colonne(s) inconnue(s) ignorée(s) — ${unknown.join(', ')}`);
    }
    if (missingRequired.length) {
      warnings.push(`« ${desc.name} » : colonne(s) obligatoire(s) absente(s) de l'archive — ${missingRequired.join(', ')}`);
    }
    tables.push({
      table: desc.name, label: desc.label, rows: rows.length,
      unknownColumns: unknown, missingColumns: missingRequired, skipped: false,
    });
  }

  // Correspondance des hôtels de l'archive avec ceux de l'instance
  const hotels = [];
  for (const h of manifest.hotels || []) {
    const [rows] = await db.query('SELECT id, nom FROM hotels WHERE slug = ?', [h.slug]);
    hotels.push({ ...h, existing: rows[0] ? { id: rows[0].id, nom: rows[0].nom } : null });
  }

  const uploadEntries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.startsWith('uploads/'));
  const unsafe = uploadEntries.filter(e => !safeUploadTarget(e.entryName)).map(e => e.entryName);
  if (unsafe.length) {
    warnings.push(`${unsafe.length} fichier(s) au chemin invalide seront refusés.`);
  }

  const sameInstance = manifest.instance_id === instance;
  if (!sameInstance) {
    warnings.push("Archive issue d'une autre instance : les médias seront rangés dans un dossier dédié pour ne rien écraser.");
  }
  if (manifest.redacted?.length) {
    warnings.push(`Champs sensibles absents de l'archive (valeurs actuelles conservées) : ${manifest.redacted.join(', ')}`);
  }
  if (manifest.uploads?.missing?.length) {
    warnings.push(`${manifest.uploads.missing.length} média(s) étaient déjà introuvables au moment de l'export.`);
  }

  return {
    manifest, tables, hotels, warnings, same_instance: sameInstance,
    scope_label: SCOPE_LABELS[manifest.scope] || manifest.scope,
    uploads: { files: uploadEntries.length, bytes: uploadEntries.reduce((s, e) => s + e.header.size, 0) },
    total_rows: tables.reduce((s, t) => s + t.rows, 0),
  };
}

// ── Import ──────────────────────────────────────────────────────────────────

function naturalLookup(desc, row) {
  if (!desc.natural?.length) return null;
  const where = [];
  const params = [];
  for (const col of desc.natural) {
    const v = row[col];
    if (col === desc.hotelColumn) {
      // hotel_id NULL est porteur de sens (ligne globale) : comparaison
      // null-safe pour retrouver la même ligne globale d'un import à l'autre.
      where.push(`\`${col}\` <=> ?`);
      params.push(v ?? null);
      continue;
    }
    if (v === null || v === undefined) return null; // pas de clé → insertion
    where.push(`\`${col}\` = ?`);
    params.push(v);
  }
  return { where: where.join(' AND '), params };
}

// Certaines tables n'ont aucune colonne propre qui identifie la ligne : leur
// identité est portée par une table enfant (l'intitulé français d'une info
// utile, par exemple). On la retrouve par jointure sur les données de l'archive.
function viaLookup(desc, row, raw, data) {
  const via = desc.naturalVia;
  if (!via || !desc.pk) return null;
  const children = data[via.table];
  if (!children?.length) return null;

  const sourceId = raw[desc.pk];
  const child = children.find(c => c[via.fk] === sourceId &&
    Object.entries(via.where || {}).every(([k, v]) => c[k] === v));
  if (!child) return null;

  const where  = [];
  const params = [];
  for (const [k, v] of Object.entries(via.where || {})) { where.push(`t.\`${k}\` = ?`); params.push(v); }
  for (const col of via.keyColumns) {
    const v = child[col];
    if (v === null || v === undefined) return null;
    where.push(`t.\`${col}\` = ?`);
    params.push(v);
  }
  for (const col of via.parentColumns || []) {
    const v = row[col];
    if (v === null || v === undefined) continue;
    where.push(`p.\`${col}\` = ?`);
    params.push(v);
  }
  return {
    sql: `SELECT p.\`${desc.pk}\` AS pk FROM \`${desc.name}\` p
          JOIN \`${via.table}\` t ON t.\`${via.fk}\` = p.\`${desc.pk}\`
          WHERE ${where.join(' AND ')} LIMIT 1`,
    params,
  };
}

// Colonne disant QUI a soumis la ligne, par opposition à « à quel hôtel elle
// est rattachée ». Un import ne la réécrit jamais vers sa destination.
const isProvenanceColumn = (desc, col) => !!desc.hotelColumnIsProvenance && col === desc.hotelColumn;

// Le mode remplacement peut-il vider cette table dans ce périmètre ?
const mayPurge = (desc, scope) => !desc.purgeScopes || desc.purgeScopes.includes(scope);

function purgeStatement(desc, scope, hotelIds) {
  // Certaines tables ne peuvent être vidées que dans certains périmètres :
  // ailleurs, d'autres établissements en dépendent par clé étrangère et la
  // suppression casserait leurs rattachements par cascade — ou échouerait sur
  // une contrainte RESTRICT. Ces lignes sont mises à jour, pas recréées.
  if (!mayPurge(desc, scope)) return null;

  // Table fille : traitée parent par parent au moment de l'insertion, pour ne
  // jamais effacer les lignes d'un parent que l'archive ne contient pas.
  if (desc.parentRef) return null;

  const restrict = desc.purgeWhere ? [desc.purgeWhere] : [];
  const build = (extra, params) => ({
    sql: `DELETE FROM \`${desc.name}\`${[...restrict, ...extra].length
      ? ` WHERE ${[...restrict, ...extra].join(' AND ')}` : ''}`,
    params,
  });

  if (scope === 'full') return build([], []);
  if (scope === 'hotel') {
    if (!desc.hotelColumn || !hotelIds.length) return null;
    return build([`\`${desc.hotelColumn}\` IN (${ph(hotelIds.length)})`], hotelIds);
  }
  // global : on ne touche pas aux données propres à un hôtel
  if (!desc.hotelColumn) return build([], []);
  if (desc.hotelOptional) return build([`\`${desc.hotelColumn}\` IS NULL`], []);
  return null;
}

/**
 * Réinjecte l'archive.
 *
 * @param source            chemin du .zip ou Buffer
 * @param mode              'merge' (complète l'existant) | 'replace' (vide le
 *                          périmètre restauré avant d'insérer)
 * @param targetHotelId     hôtel de destination (périmètre « hotel »)
 * @param createMissingHotels autoriser la création des hôtels absents
 * @param actor             { id, email } pour le journal d'audit
 */
async function applyArchive(source, { mode = 'merge', targetHotelId = null, createMissingHotels = false, actor = null } = {}) {
  if (!['merge', 'replace'].includes(mode)) throw new Error(`Mode inconnu — ${mode}`);
  const { zip, manifest, data } = openArchive(source);
  const meta     = await columnMeta();
  const instance = await ensureInstanceId();
  const scope    = manifest.scope;

  const report = {
    scope, mode,
    inserted: {}, updated: {}, skipped: {}, purged: {},
    hotels: [], uploads: { written: 0, refused: [], relocated: false },
    warnings: [],
  };

  // ── 1. Résoudre la destination des hôtels ───────────────────────────────
  const hotelMap = new Map(); // id source → id cible
  const archiveHotels = manifest.hotels || [];
  let provenanceStays = true; // la provenance du contenu partagé reste-t-elle valable ?

  if (scope === 'hotel') {
    if (archiveHotels.length !== 1) {
      throw Object.assign(new Error("Archive d'hôtel invalide : un seul établissement attendu"), { status: 400 });
    }
    if (!targetHotelId) throw Object.assign(new Error('Hôtel de destination requis'), { status: 400 });
    const [rows] = await db.query('SELECT id, slug, nom FROM hotels WHERE id = ?', [targetHotelId]);
    if (!rows[0]) throw Object.assign(new Error('Hôtel de destination introuvable'), { status: 404 });
    hotelMap.set(archiveHotels[0].id, rows[0].id);
    report.hotels.push({ from: archiveHotels[0].slug, to: rows[0].slug, created: false });
    // Même slug = on restaure le même établissement, la provenance du contenu
    // partagé reste valable. Slug différent = duplication vers un autre
    // établissement : la paternité du contenu partagé ne doit pas suivre.
    provenanceStays = rows[0].slug === archiveHotels[0].slug;
    if (!provenanceStays) {
      report.warnings.push(
        "Duplication vers un autre établissement : le contenu partagé (événements, infos utiles) est rattaché à la destination sans changer de propriétaire."
      );
    }
  } else {
    for (const h of archiveHotels) {
      const [rows] = await db.query('SELECT id, slug FROM hotels WHERE slug = ?', [h.slug]);
      if (rows[0]) {
        hotelMap.set(h.id, rows[0].id);
        report.hotels.push({ from: h.slug, to: rows[0].slug, created: false });
      } else if (createMissingHotels) {
        const [r] = await db.query('INSERT INTO hotels (slug, nom) VALUES (?, ?)', [h.slug, h.nom]);
        hotelMap.set(h.id, r.insertId);
        report.hotels.push({ from: h.slug, to: h.slug, created: true });
      } else {
        report.warnings.push(`Hôtel « ${h.slug} » absent de cette instance : ses données sont ignorées.`);
      }
    }
  }
  const targetHotelIds = [...new Set(hotelMap.values())];

  // ── 2. Médias : sur place, ou rangés à part si l'archive vient d'ailleurs ─
  // Les médias ne sont déplacés que si l'archive vient d'une AUTRE instance :
  // là, un fichier de même nom appartient à quelqu'un d'autre et l'écraser
  // détruirait une image en service. Sur la même instance les fichiers sont
  // déjà en place — même pour un clone vers un autre établissement, où les
  // réécrire ne ferait que dupliquer les photos des lieux partagés.
  const inPlace = manifest.instance_id === instance;
  report.uploads.relocated = !inPlace;

  const pathMap  = new Map(); // ancien chemin → nouveau chemin
  const stamp    = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const destRel  = path.join('restored', stamp);

  // On se contente ici de CALCULER la destination de chaque fichier : rien n'est
  // écrit sur le disque avant que la transaction ne soit validée, pour qu'un
  // import qui échoue ne laisse pas de médias orphelins derrière lui.
  const toWrite = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith('uploads/')) continue;
    const original = '/' + entry.entryName;
    let abs;
    if (inPlace) {
      abs = safeUploadTarget(entry.entryName);
    } else {
      abs = path.join(UPLOADS_ROOT, destRel, sanitizeBasename(entry.entryName));
      pathMap.set(original, `${UPLOAD_PREFIX}${destRel.split(path.sep).join('/')}/${path.basename(abs)}`);
    }
    if (!abs) { report.uploads.refused.push(entry.entryName); continue; }
    toWrite.push({ abs, entry });
  }

  // ── 3. Écriture en base, dans une transaction ────────────────────────────
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (mode === 'replace') {
      for (const desc of purgeSequence()) {
        if (!meta.has(desc.name)) continue;
        if (!data[desc.name] && scope !== 'full') continue; // rien à restaurer ici
        const stmt = purgeStatement(desc, scope, targetHotelIds);
        if (!stmt) continue;
        const [res] = await conn.query(stmt.sql, stmt.params);
        if (res.affectedRows) report.purged[desc.name] = res.affectedRows;
      }
      if (scope !== 'full') {
        const kept = purgeSequence()
          .filter(d => !mayPurge(d, scope) && data[d.name]?.length)
          .map(d => d.label);
        if (kept.length) {
          report.warnings.push(
            `Contenu partagé mis à jour sans être vidé (d'autres établissements s'y rattachent) : ${kept.join(', ')}.`
          );
        }
      }
    }

    const idMaps = new Map(); // table → Map(id source → id cible)
    idMaps.set('hotels', hotelMap);

    for (const desc of insertSequence()) {
      if (desc.name === 'hotels') continue; // déjà résolu à l'étape 1
      const rows = data[desc.name];
      if (!rows?.length) continue;
      const cols = meta.get(desc.name);
      if (!cols) { report.skipped[desc.name] = rows.length; continue; }

      const map = new Map();
      idMaps.set(desc.name, map);
      let inserted = 0, updated = 0, skipped = 0;

      // Remplacement d'une table fille : on vide les lignes des seuls parents
      // que l'archive rétablit, pour que les traductions retirées depuis
      // l'export disparaissent sans toucher au reste.
      if (mode === 'replace' && desc.parentRef && desc.refs?.[desc.parentRef]) {
        const parentMap = idMaps.get(desc.refs[desc.parentRef]);
        const ids = [...new Set(rows
          .map(r => parentMap?.get(r[desc.parentRef]))
          .filter(v => v !== null && v !== undefined))];
        if (ids.length) {
          const [res] = await conn.query(
            `DELETE FROM \`${desc.name}\` WHERE \`${desc.parentRef}\` IN (${ph(ids.length)})`, ids);
          if (res.affectedRows) {
            report.purged[desc.name] = (report.purged[desc.name] || 0) + res.affectedRows;
          }
        }
      }

      for (const raw of rows) {
        const sourceId = desc.pk ? raw[desc.pk] : null;
        const row = {};
        let broken = false;

        for (const [col, value] of Object.entries(raw)) {
          if (!cols.has(col)) continue;                      // colonne disparue du schéma
          if (desc.autoPk && col === desc.pk) continue;      // id régénéré
          let v = value;

          // Colonne de provenance d'un contenu partagé (« quel hôtel a soumis
          // cet événement »). Ce n'est pas une colonne de placement : la
          // recopier vers l'hôtel de destination lui ferait voler la
          // paternité d'un contenu que d'autres affichent aussi.
          if (isProvenanceColumn(desc, col) && scope === 'hotel' && !provenanceStays) {
            row[col] = null;
            continue;
          }

          const refTable = desc.refs?.[col];
          if (refTable && v !== null && v !== undefined) {
            const refMap = idMaps.get(refTable);
            if (refMap?.has(v)) {
              v = refMap.get(v);
            } else if (BY_NAME.get(refTable)?.autoPk) {
              // Parent non importé : hôtel absent de l'archive, lieu filtré…
              // Si la colonne accepte NULL, la ligne garde tout son sens sans
              // ce rattachement — la perdre serait pire. Sinon elle serait
              // orpheline : on la laisse de côté.
              if (cols.get(col).nullable) {
                v = null;
              } else {
                broken = true;
                break;
              }
            }
          }

          if (desc.uploads?.includes(col) && isUploadPath(v) && pathMap.has(v)) {
            v = pathMap.get(v);
          }
          row[col] = deserializeValue(v, cols.get(col).dataType);
        }

        if (broken) { skipped++; continue; }

        // Colonnes obligatoires sans valeur ni défaut : on ne peut rien insérer.
        const lacking = [...cols.entries()]
          .filter(([c, m]) => !m.nullable && !m.hasDefault && !(c in row) && c !== desc.pk)
          .map(([c]) => c);
        if (lacking.length) { skipped++; continue; }

        const entries = Object.entries(row);
        if (!entries.length) { skipped++; continue; }

        // Retrouver la ligne correspondante sur l'instance cible : par clé
        // naturelle, sinon par l'identité portée par une table enfant.
        const lookup = naturalLookup(desc, row);
        let existingPk = null;   // clé primaire trouvée
        let updateBy   = null;   // clause de mise à jour { where, params }

        if (lookup) {
          const [found] = await conn.query(
            `SELECT ${desc.pk ? `\`${desc.pk}\`` : '1 AS one'} FROM \`${desc.name}\`
             WHERE ${lookup.where} LIMIT 1`, lookup.params);
          if (found[0]) {
            existingPk = desc.pk ? found[0][desc.pk] : null;
            updateBy   = lookup;
          }
        }
        if (!updateBy) {
          const via = viaLookup(desc, row, raw, data);
          if (via) {
            const [found] = await conn.query(via.sql, via.params);
            if (found[0]) {
              existingPk = found[0].pk;
              updateBy   = { where: `\`${desc.pk}\` = ?`, params: [existingPk] };
            }
          }
        }

        if (updateBy) {
          // La provenance d'une ligne déjà présente n'est pas à nous : un
          // import ne réattribue pas un contenu que son auteur a soumis.
          const setCols = entries.filter(([c]) => c !== desc.pk && !isProvenanceColumn(desc, c));
          if (setCols.length) {
            await conn.query(
              `UPDATE \`${desc.name}\` SET ${setCols.map(([c]) => `\`${c}\` = ?`).join(', ')} WHERE ${updateBy.where}`,
              [...setCols.map(([, v]) => v), ...updateBy.params]
            );
          }
          if (desc.pk && sourceId !== null) map.set(sourceId, existingPk ?? row[desc.pk]);
          updated++;
        } else {
          const [res] = await conn.query(
            `INSERT INTO \`${desc.name}\` (${entries.map(([c]) => `\`${c}\``).join(', ')})
             VALUES (${ph(entries.length)})`,
            entries.map(([, v]) => v)
          );
          if (desc.pk && sourceId !== null) {
            map.set(sourceId, desc.autoPk ? res.insertId : row[desc.pk]);
          }
          inserted++;
        }
      }

      if (inserted) report.inserted[desc.name] = inserted;
      if (updated)  report.updated[desc.name]  = updated;
      if (skipped)  report.skipped[desc.name]  = skipped;
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Transaction validée : les médias peuvent rejoindre le disque.
  for (const { abs, entry } of toWrite) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, entry.getData());
    report.uploads.written++;
  }

  report.totals = {
    inserted: Object.values(report.inserted).reduce((a, b) => a + b, 0),
    updated:  Object.values(report.updated).reduce((a, b) => a + b, 0),
    skipped:  Object.values(report.skipped).reduce((a, b) => a + b, 0),
    purged:   Object.values(report.purged).reduce((a, b) => a + b, 0),
  };
  return report;
}

// ── Instantanés conservés sur le serveur ────────────────────────────────────

function snapshotDir() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  return SNAPSHOT_DIR;
}

function snapshotPath(id) {
  // L'identifiant est le nom de fichier : il ne doit pas permettre de sortir
  // du dossier des instantanés.
  if (!/^[\w.\-]+\.zip$/.test(id)) return null;
  const abs = path.resolve(snapshotDir(), id);
  if (path.dirname(abs) !== path.resolve(SNAPSHOT_DIR)) return null;
  return abs;
}

async function createSnapshot({ scope, hotelIds = [], actor = null, reason = 'manuel' }) {
  const { buffer, manifest } = await buildArchive({ scope, hotelIds, actor });
  const dir   = snapshotDir();
  const stamp = manifest.created_at.replace(/[-:T]/g, '').slice(0, 14);
  const tag   = scope === 'hotel' ? (manifest.hotels[0]?.slug || 'hotel') : scope;
  const id    = `${stamp}_${reason}_${tag}.zip`.replace(/[^\w.\-]/g, '_');
  fs.writeFileSync(path.join(dir, id), buffer);
  pruneSnapshots();
  return { id, size: buffer.length, manifest };
}

// On ne garde qu'un historique borné : sans ça le dossier grossit sans fin sur
// un serveur où chaque import crée un instantané de sécurité.
function pruneSnapshots() {
  const dir   = snapshotDir();
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(MAX_SNAPSHOTS)) {
    try { fs.unlinkSync(path.join(dir, f)); } catch { /* déjà supprimé */ }
  }
}

function listSnapshots({ hotelId = null, scopes = null } = {}) {
  const dir = snapshotDir();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.zip'))
    .map(f => {
      const abs  = path.join(dir, f);
      const stat = fs.statSync(abs);
      let manifest = null;
      try { manifest = JSON.parse(new AdmZip(abs).readAsText('manifest.json')); } catch { /* archive abîmée */ }
      return {
        id: f, size: stat.size, created_at: manifest?.created_at || stat.mtime.toISOString(),
        scope: manifest?.scope || null,
        scope_label: SCOPE_LABELS[manifest?.scope] || null,
        hotels: manifest?.hotels || [],
        generated_by: manifest?.generated_by || null,
        rows: manifest ? Object.values(manifest.counts || {}).reduce((a, b) => a + b, 0) : null,
        readable: !!manifest,
      };
    })
    .filter(s => {
      if (scopes && s.scope && !scopes.includes(s.scope)) return false;
      // Un admin d'hôtel ne voit que les instantanés de son établissement.
      if (hotelId !== null) return s.scope === 'hotel' && s.hotels.some(h => h.id === hotelId);
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function deleteSnapshot(id) {
  const abs = snapshotPath(id);
  if (!abs || !fs.existsSync(abs)) return false;
  fs.unlinkSync(abs);
  return true;
}

module.exports = {
  SCOPES, SCOPE_LABELS, ARCHIVE_FORMAT,
  buildArchive, inspectArchive, applyArchive,
  createSnapshot, listSnapshots, deleteSnapshot, snapshotPath, snapshotDir,
  ensureInstanceId, resetColumnCache,
};
