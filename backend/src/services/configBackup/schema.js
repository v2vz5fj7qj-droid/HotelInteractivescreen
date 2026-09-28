/**
 * configBackup/schema.js — Description déclarative de ce qui entre dans une
 * archive de configuration, et comment le réinjecter.
 *
 * Tout le moteur (export, inspection, import) est piloté par ce fichier :
 * ajouter une table à la sauvegarde = ajouter un descripteur ici, rien d'autre.
 *
 * ── Pourquoi pas un dump SQL ? ──────────────────────────────────────────────
 * Un mysqldump est collé aux id AUTO_INCREMENT de l'instance source. Réimporté
 * ailleurs, il écrase l'hôtel n°1 existant ou casse les clés étrangères. Ici on
 * exporte des lignes logiques, et l'import reconstruit les id : c'est ce qui
 * permet de restaurer ET de cloner un hôtel vers une autre instance.
 *
 * ── Champs d'un descripteur ─────────────────────────────────────────────────
 *   name         nom de la table
 *   insertOrder  ordre d'insertion (les parents d'abord) ; la purge suit
 *                l'ordre inverse, ce qui respecte les FK ON DELETE RESTRICT
 *   pk           colonne de clé primaire ('id', 'code', 'hotel_id') ou null
 *                pour les tables de liaison à clé composite
 *   autoPk       true si la PK est un AUTO_INCREMENT → elle sera remappée
 *   hotelColumn  colonne portant le hotel_id → réécrite vers l'hôtel cible
 *   hotelOptional true si hotel_id NULL signifie « globale » (catégories,
 *                événements du catalogue partagé)
 *   natural      colonnes identifiant fonctionnellement la ligne. Sert à
 *                retrouver une ligne existante en mode fusion. Si une de ces
 *                colonnes est NULL, aucune correspondance n'est tentée et la
 *                ligne est insérée.
 *   naturalVia   identité portée par une table enfant (ex. une info utile est
 *                identifiée par son intitulé français, pas par ses colonnes
 *                propres). Utilisé quand `natural` est absent ou inopérant.
 *   refs         { colonne: table } clés étrangères à remapper à l'import
 *   strip        colonnes jamais exportées (secrets, id d'utilisateurs)
 *   uploads      colonnes contenant un chemin /uploads/... à embarquer
 *   neverPurge   true = jamais supprimée, même en mode remplacement
 *   purgeScopes  périmètres où le mode remplacement peut vider la table.
 *                Absent = tous. Restreint quand d'autres établissements
 *                dépendent de ces lignes par clé étrangère : les effacer
 *                casserait leurs rattachements par cascade, voire échouerait
 *                sur une contrainte RESTRICT. Ces lignes sont alors mises à
 *                jour par clé naturelle au lieu d'être recréées.
 *   hotelColumnIsProvenance
 *                true = hotelColumn dit QUI a soumis la ligne, et non à quel
 *                établissement elle est rattachée. Une telle colonne n'est
 *                jamais réécrite vers l'hôtel de destination : dupliquer la
 *                configuration d'un hôtel ne doit pas lui faire endosser la
 *                paternité d'un contenu que d'autres affichent aussi.
 *   parentRef    colonne de rattachement à la ligne mère (traductions, photos).
 *                Une telle table n'est jamais vidée en bloc : en mode
 *                remplacement on supprime uniquement les lignes des parents
 *                effectivement présents dans l'archive. Sinon un import de
 *                périmètre global effacerait les traductions du contenu propre
 *                aux hôtels, que l'archive ne contient pas et ne peut donc pas
 *                rétablir.
 *   purgeWhere   condition SQL restreignant la purge
 *   rowFilter    filtre appliqué aux lignes exportées
 *   select(ctx)  requête de sélection ; null = table hors de ce périmètre
 *   label        libellé affiché dans le rapport du back-office
 */

// Clé de theme_config portant l'identifiant d'instance. Elle ne doit jamais
// voyager dans une archive, sinon l'instance cible usurpe l'identité de la
// source et un clone serait pris pour une restauration sur place.
const INSTANCE_KEY = 'instance_id';

// Horodatages et champs purement techniques : ils se régénèrent tout seuls et
// n'ont aucun sens sur l'instance cible. Retirés de toutes les tables.
const VOLATILE_COLUMNS = new Set([
  'created_at', 'updated_at', 'last_update', 'last_fetched_at', 'last_seen_at',
  'validated_at', 'archived_at', 'used_at', 'registered_at', 'offline_notified_at',
]);

// Jamais exportées, à aucun titre : comptes et secrets d'authentification,
// jetons d'appareils, données d'exploitation volumineuses et jetables.
const EXCLUDED_TABLES = [
  'admin_users',            // mots de passe (hash) et rôles
  'kiosk_keys',             // clés d'appariement de bornes
  'kiosks',                 // jetons d'appareils — propres à une installation
  'qr_tokens',              // jetons éphémères
  'api_token_tracking',     // quotas d'API
  'audit_log',              // journal d'audit
  'analytics_events',       // statistiques d'usage
  'feedbacks',              // avis clients — données personnelles
  'weather_cache',          // cache, se reconstruit
  'workflow_notifications', // notifications internes
  'guest_codes',            // codes de séjour — données personnelles du client
  'guest_sessions',         // appareils rattachés — empreinte, user-agent, IP
];

const ph = n => Array(n).fill('?').join(',');

// ids déjà collectés pour une table donnée (utilisé par les sélections qui
// dépendent du contenu, par ex. les catégories réellement employées)
const collectedIds = (ctx, table, column = 'id') => {
  const rows = ctx.collected.get(table) || [];
  return [...new Set(rows.map(r => r[column]).filter(v => v !== null && v !== undefined))];
};

const collectedKeys = (ctx, table, column) => {
  const rows = ctx.collected.get(table) || [];
  return [...new Set(rows.map(r => r[column]).filter(Boolean))];
};

// Sélection d'une table enfant à partir des parents déjà collectés.
const childOf = (parentTable, fkColumn, childTable) => ctx => {
  const ids = collectedIds(ctx, parentTable);
  if (!ids.length) return null;
  return { sql: `SELECT * FROM ${childTable} WHERE ${fkColumn} IN (${ph(ids.length)})`, params: ids };
};

// Sélection d'une table propre à l'hôtel.
const ownedByHotel = table => ctx => {
  if (ctx.scope === 'global') return null;
  if (!ctx.hotelIds?.length) return null;
  return {
    sql: `SELECT * FROM ${table} WHERE hotel_id IN (${ph(ctx.hotelIds.length)})`,
    params: [...ctx.hotelIds],
  };
};

// En périmètre « global », une table qui accepte un hotel_id ne doit livrer que
// ses lignes partagées (hotel_id NULL). Sans ce filtre l'archive embarquerait du
// contenu propre à des hôtels qu'elle ne décrit pas, et l'import l'ignorerait.
const sharedOnly = (table, hotelColumn = 'hotel_id') => ctx =>
  ctx.scope === 'global'
    ? { sql: `SELECT * FROM ${table} WHERE ${hotelColumn} IS NULL`, params: [] }
    : { sql: `SELECT * FROM ${table}`, params: [] };

// Catégories : celles de l'hôtel, plus les globales effectivement utilisées par
// le contenu exporté. Sans ça une restauration affiche des fiches sans
// catégorie ; avec « toutes les globales » on pollue l'instance cible.
const categorySelect = (table, contentTable, contentColumn) => ctx => {
  if (ctx.scope !== 'hotel') return sharedOnly(table)(ctx);
  if (!ctx.hotelIds?.length) return null;
  const keys   = collectedKeys(ctx, contentTable, contentColumn);
  const clauses = [`hotel_id IN (${ph(ctx.hotelIds.length)})`];
  const params  = [...ctx.hotelIds];
  if (keys.length) {
    clauses.push(`(hotel_id IS NULL AND key_name IN (${ph(keys.length)}))`);
    params.push(...keys);
  }
  return { sql: `SELECT * FROM ${table} WHERE ${clauses.join(' OR ')}`, params };
};

const TABLES = [
  // ── Identité de l'hôtel ───────────────────────────────────────────────────
  {
    name: 'hotels', label: 'Hôtel', insertOrder: 10,
    pk: 'id', autoPk: true, natural: ['slug'], neverPurge: true,
    select: ctx => {
      if (ctx.scope === 'global') return null;
      if (!ctx.hotelIds?.length) return null;
      return { sql: `SELECT * FROM hotels WHERE id IN (${ph(ctx.hotelIds.length)})`, params: [...ctx.hotelIds] };
    },
  },

  // ── Configuration de l'hôtel ──────────────────────────────────────────────
  {
    name: 'hotel_settings', label: 'Paramètres & identité visuelle', insertOrder: 80,
    pk: 'hotel_id', autoPk: false, hotelColumn: 'hotel_id', natural: ['hotel_id'],
    refs: { hotel_id: 'hotels' },
    uploads: ['logo_url', 'logo_url_dark', 'background_url', 'font_file_url'],
    select: ownedByHotel('hotel_settings'),
  },
  {
    name: 'devise_config', label: 'Convertisseur de devises', insertOrder: 80,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', natural: ['hotel_id'],
    refs: { hotel_id: 'hotels' },
    // Clé d'API d'un fournisseur de taux payant : jamais dans un fichier qui
    // circule par mail. L'import conserve celle déjà présente sur la cible.
    strip: ['api_key'],
    select: ownedByHotel('devise_config'),
  },
  {
    name: 'hotel_banner_images', label: 'Images de bannière', insertOrder: 80,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', natural: ['hotel_id', 'url'],
    refs: { hotel_id: 'hotels' }, uploads: ['url'],
    select: ownedByHotel('hotel_banner_images'),
  },
  {
    name: 'hotel_tips', label: 'Bon à savoir', insertOrder: 80,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', natural: ['hotel_id', 'titre_fr'],
    refs: { hotel_id: 'hotels' }, strip: ['created_by'],
    select: ownedByHotel('hotel_tips'),
  },
  {
    name: 'notifications', label: 'Messages défilants', insertOrder: 80,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', hotelOptional: true,
    natural: ['hotel_id', 'message_fr'], refs: { hotel_id: 'hotels' },
    select: ctx => ctx.scope === 'hotel'
      ? ownedByHotel('notifications')(ctx)
      : sharedOnly('notifications')(ctx),
  },

  // ── Services de l'hôtel ───────────────────────────────────────────────────
  {
    name: 'services', label: 'Services', insertOrder: 85,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', natural: ['hotel_id', 'slug'],
    refs: { hotel_id: 'hotels', category_id: 'service_categories' },
    uploads: ['image_url', 'video_url'],
    select: ownedByHotel('services'),
  },
  {
    name: 'service_translations', label: 'Traductions des services', insertOrder: 86,
    parentRef: 'service_id',
    pk: 'id', autoPk: true, natural: ['service_id', 'locale'],
    refs: { service_id: 'services' },
    select: childOf('services', 'service_id', 'service_translations'),
  },
  {
    name: 'service_categories', label: 'Catégories de services', insertOrder: 30,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', hotelOptional: true,
    // Purge possible pour un hôtel (ses services sont supprimés avant), mais
    // pas pour les catégories globales : les services d'autres hôtels s'y
    // réfèrent avec ON DELETE RESTRICT.
    purgeScopes: ['hotel', 'full'],
    natural: ['hotel_id', 'label_fr'], refs: { hotel_id: 'hotels' }, strip: ['created_by'],
    select: ctx => {
      if (ctx.scope !== 'hotel') return sharedOnly('service_categories')(ctx);
      if (!ctx.hotelIds?.length) return null;
      const used    = collectedIds(ctx, 'services', 'category_id');
      const clauses = [`hotel_id IN (${ph(ctx.hotelIds.length)})`];
      const params  = [...ctx.hotelIds];
      if (used.length) { clauses.push(`id IN (${ph(used.length)})`); params.push(...used); }
      return { sql: `SELECT * FROM service_categories WHERE ${clauses.join(' OR ')}`, params };
    },
  },

  // ── Lieux (carte) ─────────────────────────────────────────────────────────
  {
    name: 'points_of_interest', label: 'Lieux', insertOrder: 40,
    pk: 'id', autoPk: true, natural: ['category', 'lat', 'lng'],
    purgeScopes: ['full'],   // rattachés par hotel_places dans tous les hôtels
    strip: ['created_by', 'validated_by'],
    select: ctx => {
      if (ctx.scope !== 'hotel') return { sql: 'SELECT * FROM points_of_interest', params: [] };
      if (!ctx.hotelIds?.length) return null;
      return {
        sql: `SELECT * FROM points_of_interest
              WHERE id IN (SELECT place_id FROM hotel_places WHERE hotel_id IN (${ph(ctx.hotelIds.length)}))`,
        params: [...ctx.hotelIds],
      };
    },
  },
  {
    name: 'poi_translations', label: 'Traductions des lieux', insertOrder: 41,
    parentRef: 'poi_id',
    pk: 'id', autoPk: true, natural: ['poi_id', 'locale'], refs: { poi_id: 'points_of_interest' },
    select: childOf('points_of_interest', 'poi_id', 'poi_translations'),
  },
  {
    name: 'poi_images', label: 'Photos des lieux', insertOrder: 41,
    parentRef: 'poi_id',
    pk: 'id', autoPk: true, natural: ['poi_id', 'url'], refs: { poi_id: 'points_of_interest' },
    uploads: ['url'],
    select: childOf('points_of_interest', 'poi_id', 'poi_images'),
  },
  {
    name: 'poi_categories', label: 'Catégories de lieux', insertOrder: 30,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', hotelOptional: true,
    natural: ['hotel_id', 'key_name'], refs: { hotel_id: 'hotels' }, strip: ['created_by'],
    select: categorySelect('poi_categories', 'points_of_interest', 'category'),
  },

  // ── Agenda ────────────────────────────────────────────────────────────────
  {
    name: 'events', label: 'Événements', insertOrder: 50,
    pk: 'id', autoPk: true, hotelColumn: 'owner_hotel_id', hotelOptional: true,
    hotelColumnIsProvenance: true,
    purgeScopes: ['full'],   // rattachés par hotel_events dans tous les hôtels
    natural: ['slug'], refs: { owner_hotel_id: 'hotels' },
    strip: ['created_by', 'validated_by'], uploads: ['image_url'],
    select: ctx => {
      if (ctx.scope !== 'hotel') return sharedOnly('events', 'owner_hotel_id')(ctx);
      if (!ctx.hotelIds?.length) return null;
      const list = ph(ctx.hotelIds.length);
      return {
        sql: `SELECT * FROM events
              WHERE id IN (SELECT event_id FROM hotel_events WHERE hotel_id IN (${list}))
                 OR owner_hotel_id IN (${list})`,
        params: [...ctx.hotelIds, ...ctx.hotelIds],
      };
    },
  },
  {
    name: 'event_translations', label: 'Traductions des événements', insertOrder: 51,
    parentRef: 'event_id',
    pk: 'id', autoPk: true, natural: ['event_id', 'locale'], refs: { event_id: 'events' },
    select: childOf('events', 'event_id', 'event_translations'),
  },
  {
    name: 'event_categories', label: "Catégories d'événements", insertOrder: 30,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', hotelOptional: true,
    natural: ['hotel_id', 'key_name'], refs: { hotel_id: 'hotels' }, strip: ['created_by'],
    select: categorySelect('event_categories', 'events', 'category'),
  },

  // ── Infos utiles ──────────────────────────────────────────────────────────
  {
    name: 'useful_contacts', label: 'Infos utiles', insertOrder: 60,
    pk: 'id', autoPk: true, hotelColumn: 'owner_hotel_id', hotelOptional: true,
    hotelColumnIsProvenance: true,
    purgeScopes: ['full'],   // rattachés par hotel_info dans tous les hôtels
    // Aucune colonne propre n'identifie une fiche : le téléphone est
    // facultatif et modifiable. L'identité, c'est l'intitulé français, qui
    // vit dans la table des traductions.
    naturalVia: {
      table: 'useful_contact_translations', fk: 'contact_id',
      where: { locale: 'fr' }, keyColumns: ['name'], parentColumns: ['category'],
    },
    refs: { owner_hotel_id: 'hotels' },
    strip: ['created_by', 'validated_by'],
    select: ctx => {
      if (ctx.scope !== 'hotel') return sharedOnly('useful_contacts', 'owner_hotel_id')(ctx);
      if (!ctx.hotelIds?.length) return null;
      const list = ph(ctx.hotelIds.length);
      return {
        sql: `SELECT * FROM useful_contacts
              WHERE id IN (SELECT info_id FROM hotel_info WHERE hotel_id IN (${list}))
                 OR owner_hotel_id IN (${list})`,
        params: [...ctx.hotelIds, ...ctx.hotelIds],
      };
    },
  },
  {
    name: 'useful_contact_translations', label: 'Traductions des infos utiles', insertOrder: 61,
    parentRef: 'contact_id',
    pk: 'id', autoPk: true, natural: ['contact_id', 'locale'], refs: { contact_id: 'useful_contacts' },
    select: childOf('useful_contacts', 'contact_id', 'useful_contact_translations'),
  },
  {
    name: 'info_categories', label: "Catégories d'infos utiles", insertOrder: 30,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', hotelOptional: true,
    natural: ['hotel_id', 'key_name'], refs: { hotel_id: 'hotels' }, strip: ['created_by'],
    select: categorySelect('info_categories', 'useful_contacts', 'category'),
  },

  // ── Bien-être (catalogue historique, sans hôtel) ───────────────────────────
  {
    name: 'wellness_services', label: 'Services bien-être', insertOrder: 70,
    pk: 'id', autoPk: true, natural: ['slug'], uploads: ['image_url', 'video_url'],
    select: ctx => ctx.scope === 'hotel' ? null : { sql: 'SELECT * FROM wellness_services', params: [] },
  },
  {
    name: 'wellness_service_translations', label: 'Traductions bien-être', insertOrder: 71,
    parentRef: 'service_id',
    pk: 'id', autoPk: true, natural: ['service_id', 'locale'], refs: { service_id: 'wellness_services' },
    select: childOf('wellness_services', 'service_id', 'wellness_service_translations'),
  },

  // ── Météo ─────────────────────────────────────────────────────────────────
  {
    name: 'localities', label: 'Localités météo', insertOrder: 20,
    pk: 'id', autoPk: true, natural: ['name', 'country'],
    purgeScopes: ['full'],   // hotel_weather_localities les protège en RESTRICT
    select: ctx => {
      if (ctx.scope !== 'hotel') return { sql: 'SELECT * FROM localities', params: [] };
      if (!ctx.hotelIds?.length) return null;
      return {
        sql: `SELECT * FROM localities
              WHERE id IN (SELECT locality_id FROM hotel_weather_localities WHERE hotel_id IN (${ph(ctx.hotelIds.length)}))`,
        params: [...ctx.hotelIds],
      };
    },
  },

  // ── Vols : la planification de rafraîchissement vit dans la table airports ─
  {
    name: 'airports', label: 'Aéroports & planification des vols', insertOrder: 20,
    pk: 'code', autoPk: false, natural: ['code'],
    purgeScopes: ['full'],   // suivis par hotel_airports dans tous les hôtels
    select: ctx => {
      if (ctx.scope !== 'hotel') return { sql: 'SELECT * FROM airports', params: [] };
      if (!ctx.hotelIds?.length) return null;
      return {
        sql: `SELECT * FROM airports
              WHERE code IN (SELECT airport_code FROM hotel_airports WHERE hotel_id IN (${ph(ctx.hotelIds.length)}))`,
        params: [...ctx.hotelIds],
      };
    },
  },

  // ── Thème global (back-office historique mono-hôtel) ──────────────────────
  {
    name: 'theme_config', label: 'Thème global', insertOrder: 20,
    pk: 'id', autoPk: true, natural: ['config_key'],
    rowFilter: r => r.config_key !== INSTANCE_KEY,
    // L'identité de l'instance cible ne doit jamais disparaître : c'est elle
    // qui distingue plus tard une restauration sur place d'un import externe.
    purgeWhere: `config_key <> '${INSTANCE_KEY}'`,
    select: ctx => ctx.scope === 'hotel' ? null : { sql: 'SELECT * FROM theme_config', params: [] },
  },

  // ── Rattachements hôtel ↔ catalogue ───────────────────────────────────────
  {
    name: 'hotel_places', label: 'Lieux affichés par l\'hôtel', insertOrder: 90,
    pk: null, hotelColumn: 'hotel_id', natural: ['hotel_id', 'place_id'],
    refs: { hotel_id: 'hotels', place_id: 'points_of_interest' },
    select: ownedByHotel('hotel_places'),
  },
  {
    name: 'hotel_events', label: 'Événements affichés par l\'hôtel', insertOrder: 90,
    pk: null, hotelColumn: 'hotel_id', natural: ['hotel_id', 'event_id'],
    refs: { hotel_id: 'hotels', event_id: 'events' },
    select: ownedByHotel('hotel_events'),
  },
  {
    name: 'hotel_info', label: 'Infos utiles affichées par l\'hôtel', insertOrder: 90,
    pk: null, hotelColumn: 'hotel_id', natural: ['hotel_id', 'info_id'],
    refs: { hotel_id: 'hotels', info_id: 'useful_contacts' },
    select: ownedByHotel('hotel_info'),
  },
  {
    name: 'hotel_airports', label: 'Aéroports suivis par l\'hôtel', insertOrder: 90,
    pk: null, hotelColumn: 'hotel_id', natural: ['hotel_id', 'airport_code'],
    refs: { hotel_id: 'hotels', airport_code: 'airports' },
    select: ownedByHotel('hotel_airports'),
  },
  {
    name: 'hotel_weather_localities', label: 'Localités météo de l\'hôtel', insertOrder: 90,
    pk: 'id', autoPk: true, hotelColumn: 'hotel_id', natural: ['hotel_id', 'locality_id'],
    refs: { hotel_id: 'hotels', locality_id: 'localities' },
    select: ownedByHotel('hotel_weather_localities'),
  },
];

// Ordre de sélection à l'export : une table qui dépend du contenu déjà collecté
// (catégories, traductions) doit venir après ce dont elle dépend.
const SELECT_ORDER = [
  'hotels', 'hotel_settings', 'devise_config', 'hotel_banner_images', 'hotel_tips',
  'notifications',
  'services', 'service_translations', 'service_categories',
  'points_of_interest', 'poi_translations', 'poi_images', 'poi_categories',
  'events', 'event_translations', 'event_categories',
  'useful_contacts', 'useful_contact_translations', 'info_categories',
  'wellness_services', 'wellness_service_translations',
  'localities', 'airports', 'theme_config',
  'hotel_places', 'hotel_events', 'hotel_info', 'hotel_airports', 'hotel_weather_localities',
];

const BY_NAME = new Map(TABLES.map(t => [t.name, t]));

const selectSequence = () => SELECT_ORDER.map(n => {
  const t = BY_NAME.get(n);
  if (!t) throw new Error(`configBackup: SELECT_ORDER référence une table inconnue — ${n}`);
  return t;
});

const insertSequence = () => [...TABLES].sort((a, b) =>
  a.insertOrder - b.insertOrder || SELECT_ORDER.indexOf(a.name) - SELECT_ORDER.indexOf(b.name));

const purgeSequence = () => insertSequence().reverse().filter(t => !t.neverPurge);

// Garde-fou : une table de la base qui n'est ni sauvegardée ni explicitement
// exclue est une omission. Appelé au démarrage pour le signaler dans les logs.
function unclassifiedTables(allTableNames) {
  const known = new Set([...BY_NAME.keys(), ...EXCLUDED_TABLES]);
  return allTableNames.filter(n => !known.has(n));
}

module.exports = {
  INSTANCE_KEY, VOLATILE_COLUMNS, EXCLUDED_TABLES, TABLES, BY_NAME,
  selectSequence, insertSequence, purgeSequence, unclassifiedTables,
};
