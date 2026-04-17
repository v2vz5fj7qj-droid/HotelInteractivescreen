/**
 * runMigrations — migrations SQL appliquées automatiquement au démarrage.
 * Chaque migration est idempotente : elle vérifie l'état avant d'agir.
 */
const db = require('./db');

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE table_schema = DATABASE()
       AND table_name   = ?
       AND column_name  = ?`,
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE table_schema = DATABASE()
       AND table_name   = ?
       AND index_name   = ?`,
    [table, indexName]
  );
  return rows[0].cnt > 0;
}

async function migration003() {
  const tables = [
    { table: 'poi_categories',   uq: 'uq_poi_cat_key_hotel'   },
    { table: 'event_categories', uq: 'uq_event_cat_key_hotel'  },
    { table: 'info_categories',  uq: 'uq_info_cat_key_hotel'   },
  ];

  for (const { table, uq } of tables) {
    // 1. Ajouter hotel_id si absent
    if (!(await columnExists(table, 'hotel_id'))) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN hotel_id INT NULL DEFAULT NULL`);
      console.log(`[migration003] ${table}: colonne hotel_id ajoutée`);
    }

    // 2. Ajouter created_by si absent
    if (!(await columnExists(table, 'created_by'))) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN created_by INT NULL DEFAULT NULL`);
      console.log(`[migration003] ${table}: colonne created_by ajoutée`);
    }

    // 3. Remplacer l'index UNIQUE simple (key_name) par l'index composite
    if (await indexExists(table, 'key_name')) {
      await db.query(`ALTER TABLE ${table} DROP INDEX \`key_name\``);
      console.log(`[migration003] ${table}: ancien index key_name supprimé`);
    }

    if (!(await indexExists(table, uq))) {
      await db.query(`ALTER TABLE ${table} ADD UNIQUE KEY \`${uq}\` (key_name, hotel_id)`);
      console.log(`[migration003] ${table}: index composite ${uq} créé`);
    }
  }
}

async function migration004() {
  if (!(await columnExists('hotel_tips', 'translations_json'))) {
    await db.query(
      `ALTER TABLE hotel_tips
         ADD COLUMN translations_json TEXT NULL DEFAULT NULL
         COMMENT 'JSON des traductions supplémentaires hors FR/EN'`
    );
    console.log('[migration004] hotel_tips: colonne translations_json ajoutée');
  }
}

async function migration007() {
  if (!(await columnExists('hotel_settings', 'welcome_message_fr'))) {
    await db.query(
      `ALTER TABLE hotel_settings
         ADD COLUMN welcome_message_fr TEXT NULL DEFAULT NULL
         COMMENT 'Message d''accueil affiché en bannière (FR)'`
    );
    console.log('[migration007] hotel_settings: colonne welcome_message_fr ajoutée');
  }
  if (!(await columnExists('hotel_settings', 'welcome_message_en'))) {
    await db.query(
      `ALTER TABLE hotel_settings
         ADD COLUMN welcome_message_en TEXT NULL DEFAULT NULL
         COMMENT 'Message d''accueil affiché en bannière (EN)'`
    );
    console.log('[migration007] hotel_settings: colonne welcome_message_en ajoutée');
  }
}

async function migration008() {
  const extra = ['de', 'es', 'pt', 'ar', 'zh', 'ja', 'ru'];
  for (const lang of extra) {
    const col = `welcome_message_${lang}`;
    if (!(await columnExists('hotel_settings', col))) {
      await db.query(
        `ALTER TABLE hotel_settings ADD COLUMN ${col} TEXT NULL DEFAULT NULL`
      );
      console.log(`[migration008] hotel_settings: colonne ${col} ajoutée`);
    }
  }
}

async function migration009() {
  const [tables] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE table_schema = DATABASE() AND table_name = 'hotel_banner_images'`
  );
  if (tables[0].cnt > 0) return;
  await db.query(`
    CREATE TABLE hotel_banner_images (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      hotel_id      INT NOT NULL,
      url           VARCHAR(500) NOT NULL,
      display_order INT NOT NULL DEFAULT 0,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
      INDEX idx_hotel_banner (hotel_id, display_order)
    )
  `);
  console.log('[migration009] table hotel_banner_images créée');
}

async function runMigrations() {
  try {
    await migration003();
    await migration004();
    await migration007();
    await migration008();
    await migration009();
    console.log('✅ Migrations : OK');
  } catch (err) {
    console.error('[runMigrations] Erreur :', err.message);
  }
}

module.exports = { runMigrations };
