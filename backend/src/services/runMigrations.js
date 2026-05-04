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

async function migration010() {
  const [tables] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE table_schema = DATABASE() AND table_name = 'feedbacks'`
  );
  if (tables[0].cnt > 0) return;
  await db.query(`
    CREATE TABLE feedbacks (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      hotel_id     INT NOT NULL,
      categories   JSON NOT NULL,
      commentaire  TEXT NULL,
      note_globale DECIMAL(3,2) NOT NULL,
      locale       VARCHAR(5) NOT NULL DEFAULT 'fr',
      ip           VARCHAR(45) NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
      INDEX idx_feedbacks_hotel_date (hotel_id, created_at)
    )
  `);
  console.log('[migration010] table feedbacks créée');
}

async function migration011() {
  const [[col]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'hotel_settings' AND column_name = 'font_file_url'`
  );
  if (col.cnt > 0) return;
  await db.query(
    `ALTER TABLE hotel_settings ADD COLUMN font_file_url VARCHAR(500) NULL DEFAULT NULL`
  );
  console.log('[migration011] colonne font_file_url ajoutée');
}

async function migration012() {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE table_schema = DATABASE() AND table_name = 'devise_config'`
  );
  if (row.cnt > 0) {
    // Table existe déjà — s'assurer que la colonne display_currencies est présente
    if (!(await columnExists('devise_config', 'display_currencies'))) {
      await db.query(
        `ALTER TABLE devise_config
           ADD COLUMN display_currencies JSON NULL DEFAULT NULL
           COMMENT 'Sous-ensemble max 5 devises affichées sur le tableau des taux'
           AFTER target_currencies`
      );
      console.log('[migration012] colonne display_currencies ajoutée');
    }
    return;
  }
  await db.query(`
    CREATE TABLE devise_config (
      id                    INT          NOT NULL AUTO_INCREMENT,
      hotel_id              INT          NOT NULL,
      base_currency         VARCHAR(3)   NOT NULL DEFAULT 'XOF',
      target_currencies     JSON         NOT NULL,
      display_currencies    JSON         NULL DEFAULT NULL,
      update_mode           ENUM('auto','manual') NOT NULL DEFAULT 'auto',
      update_interval_hours INT          NOT NULL DEFAULT 6,
      daily_update_times    JSON         NULL DEFAULT NULL,
      rates                 JSON         NULL DEFAULT NULL,
      last_update           TIMESTAMP    NULL DEFAULT NULL,
      api_provider          VARCHAR(50)  NOT NULL DEFAULT 'open.er-api.com',
      api_key               VARCHAR(255) NULL DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_hotel (hotel_id),
      CONSTRAINT fk_devise_hotel FOREIGN KEY (hotel_id)
        REFERENCES hotels (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[migration012] table devise_config créée');
}

async function migration013() {
  if (!(await columnExists('hotel_tips', 'is_notification'))) {
    await db.query(
      `ALTER TABLE hotel_tips
         ADD COLUMN is_notification TINYINT(1) NOT NULL DEFAULT 0
         AFTER is_active`
    );
    console.log('[migration013] hotel_tips: colonne is_notification ajoutée');
  }
}

async function runMigrations() {
  try {
    await migration003();
    await migration004();
    await migration007();
    await migration008();
    await migration009();
    await migration010();
    await migration011();
    await migration012();
    await migration013();
    console.log('✅ Migrations : OK');
  } catch (err) {
    console.error('[runMigrations] Erreur :', err.message);
  }
}

module.exports = { runMigrations };
