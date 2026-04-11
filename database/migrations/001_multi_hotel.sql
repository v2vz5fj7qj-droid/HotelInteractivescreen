-- ════════════════════════════════════════════════════════════════
--  ConnectBé — Migration 001 : Architecture Multi-Hôtels
--  Branche : feat/multi-hotel
--  Date    : 2026-04-09
--
--  PRÉREQUIS : avoir effectué un dump complet de la DB avant
--  de lancer cette migration (voir backup_single_hotel_*.sql)
--
--  EXÉCUTION :
--    docker exec -i connectbe_mysql mysql \
--      -u connectbe_user -pchange_me_db connectbe_kiosk \
--      < database/migrations/001_multi_hotel.sql
-- ════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 1 — HÔTELS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hotels (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    slug       VARCHAR(100) NOT NULL UNIQUE,   -- ex: "connectbe-ouaga"
    nom        VARCHAR(200) NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer l'hôtel existant comme hôtel #1
INSERT IGNORE INTO hotels (id, slug, nom) VALUES
(1, 'connectbe-ouaga', 'ConnectBé');

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 2 — UTILISATEURS ADMIN (remplace le login unique)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id            INT          NULL,          -- NULL = super_admin ou contributor transversal
    email               VARCHAR(200) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    role                ENUM('super_admin','hotel_admin','hotel_staff','contributor') NOT NULL,
    -- Permissions modulaires (actives uniquement si role = contributor)
    can_submit_places   BOOLEAN DEFAULT FALSE,
    can_submit_events   BOOLEAN DEFAULT FALSE,
    can_submit_info     BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL
);

-- Super-admin par défaut (mot de passe à changer en prod)
-- hash bcrypt de "admin1234" — à remplacer via le backoffice
INSERT IGNORE INTO admin_users (id, hotel_id, email, password_hash, role) VALUES
(1, NULL, 'admin@iconnectbe.com', '$2b$10$placeholder_hash_to_replace', 'super_admin');

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 3 — PARAMÈTRES HÔTEL (remplace theme_config globale)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hotel_settings (
    hotel_id          INT          NOT NULL PRIMARY KEY,
    -- Branding
    nom               VARCHAR(200) NOT NULL DEFAULT 'Mon Hôtel',
    logo_url          VARCHAR(500) DEFAULT '/images/logo.png',
    logo_url_dark     VARCHAR(500) DEFAULT '/images/logo-dark.png',
    background_url    VARCHAR(500) DEFAULT NULL,
    -- Thème couleurs (JSON)
    theme_colors      JSON         NOT NULL,
    -- Typographie
    font_primary      VARCHAR(100) DEFAULT 'Poppins',
    font_secondary    VARCHAR(100) DEFAULT 'Playfair Display',
    -- Contacts hôtel
    adresse           VARCHAR(300),
    telephone         VARCHAR(30),
    email_contact     VARCHAR(200),
    lat               DECIMAL(10,7),
    lng               DECIMAL(10,7),
    -- Kiosque
    idle_timeout_ms   INT          DEFAULT 30000,
    fullscreen_password VARCHAR(100) DEFAULT 'fs1234',
    -- Dates
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- Migrer les valeurs de theme_config vers hotel_settings pour l'hôtel #1
INSERT IGNORE INTO hotel_settings (
    hotel_id, nom, logo_url, logo_url_dark, background_url,
    theme_colors, font_primary, font_secondary,
    telephone, idle_timeout_ms, fullscreen_password
)
SELECT
    1,
    MAX(CASE WHEN config_key = 'hotel_name'         THEN config_value END),
    MAX(CASE WHEN config_key = 'logo_url'           THEN config_value END),
    MAX(CASE WHEN config_key = 'logo_url_dark'      THEN config_value END),
    MAX(CASE WHEN config_key = 'banner_image_url'   THEN config_value END),
    JSON_OBJECT(
        'primary',       MAX(CASE WHEN config_key = 'color_primary'       THEN config_value END),
        'primary_dark',  MAX(CASE WHEN config_key = 'color_primary_dark'  THEN config_value END),
        'secondary',     MAX(CASE WHEN config_key = 'color_secondary'     THEN config_value END),
        'bg_dark',       MAX(CASE WHEN config_key = 'color_bg_dark'       THEN config_value END),
        'bg_light',      MAX(CASE WHEN config_key = 'color_bg_light'      THEN config_value END),
        'surface_dark',  MAX(CASE WHEN config_key = 'color_surface_dark'  THEN config_value END),
        'surface_light', MAX(CASE WHEN config_key = 'color_surface_light' THEN config_value END),
        'text_dark',     MAX(CASE WHEN config_key = 'color_text_dark'     THEN config_value END),
        'text_light',    MAX(CASE WHEN config_key = 'color_text_light'    THEN config_value END),
        'accent',        MAX(CASE WHEN config_key = 'color_accent'        THEN config_value END)
    ),
    MAX(CASE WHEN config_key = 'font_primary'       THEN config_value END),
    MAX(CASE WHEN config_key = 'font_secondary'     THEN config_value END),
    NULL,
    CAST(MAX(CASE WHEN config_key = 'idle_timeout_ms'     THEN config_value END) AS UNSIGNED),
    MAX(CASE WHEN config_key = 'fullscreen_password' THEN config_value END)
FROM theme_config;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 4 — SERVICES ET BIEN-ÊTRE
--  Remplacement de wellness_services par une structure multi-hôtels
--  avec catégories globales + propres à l'hôtel
-- ════════════════════════════════════════════════════════════════

-- Catégories de services (NULL = globale/modèle, hotel_id = propre à l'hôtel)
CREATE TABLE IF NOT EXISTS service_categories (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id      INT          NULL,    -- NULL = catégorie globale (super-admin)
    label_fr      VARCHAR(100) NOT NULL,
    label_en      VARCHAR(100),
    icon          VARCHAR(10)  DEFAULT '✨',
    display_order INT          DEFAULT 0,
    is_active     BOOLEAN      DEFAULT TRUE,
    created_by    INT          NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id)   REFERENCES hotels(id)      ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Catégories globales de base
INSERT IGNORE INTO service_categories (id, hotel_id, label_fr, label_en, icon, display_order) VALUES
(1, NULL, 'Spa & Bien-être',   'Spa & Wellness',   '🧖', 1),
(2, NULL, 'Restauration',      'Dining',           '🍽️', 2),
(3, NULL, 'Sport & Piscine',   'Sport & Pool',     '🏊', 3),
(4, NULL, 'Transport',         'Transport',        '🚗', 4),
(5, NULL, 'Loisirs',           'Leisure',          '🎯', 5);

-- Table services (remplace wellness_services, multi-hôtels)
CREATE TABLE IF NOT EXISTS services (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id         INT          NOT NULL,
    category_id      INT          NOT NULL,
    slug             VARCHAR(100) NOT NULL,
    duration_min     INT,
    price_fcfa       INT          DEFAULT 0,
    image_url        VARCHAR(255),
    video_url        VARCHAR(255),
    contact_phone    VARCHAR(20),
    booking_info     TEXT,
    available_hours  VARCHAR(100),
    available_days   VARCHAR(100),
    max_per_day      INT          DEFAULT 10,
    display_order    INT          DEFAULT 0,
    is_active        BOOLEAN      DEFAULT TRUE,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_hotel_slug (hotel_id, slug),
    FOREIGN KEY (hotel_id)    REFERENCES hotels(id)             ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS service_translations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    service_id  INT        NOT NULL,
    locale      VARCHAR(5) NOT NULL,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    benefits    TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE KEY uq_service_locale (service_id, locale)
);

-- Migrer wellness_services → services pour l'hôtel #1 (catégorie "Spa & Bien-être")
INSERT IGNORE INTO services (
    id, hotel_id, category_id, slug, duration_min, price_fcfa,
    image_url, video_url, contact_phone, booking_info,
    available_hours, available_days, max_per_day, display_order, is_active, created_at
)
SELECT
    id, 1, 1, slug, duration_min, price_fcfa,
    image_url, video_url, contact_phone, booking_info,
    available_hours, available_days, max_per_day, display_order, is_active, created_at
FROM wellness_services;

-- Migrer les traductions
INSERT IGNORE INTO service_translations (service_id, locale, name, description, benefits)
SELECT service_id, locale, name, description, benefits
FROM wellness_service_translations;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 5 — CARTE & POI — Workflow de validation + multi-hôtels
-- ════════════════════════════════════════════════════════════════

-- Ajouter colonnes workflow à points_of_interest
ALTER TABLE points_of_interest
    ADD COLUMN created_by       INT  NULL,
    ADD COLUMN status           ENUM('pending','pre_approved','published','rejected') NOT NULL DEFAULT 'published',
    ADD COLUMN validated_by     INT  NULL,
    ADD COLUMN validated_at     DATETIME NULL,
    ADD COLUMN rejection_reason VARCHAR(500) NULL,
    ADD COLUMN created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Tous les POI existants sont considérés publiés (validés par super-admin)
UPDATE points_of_interest
SET status = 'published', validated_by = 1, validated_at = NOW()
WHERE status = 'published';

-- Table de liaison lieux → hôtels (N:N)
-- Un lieu peut être affiché sur plusieurs hôtels
CREATE TABLE IF NOT EXISTS hotel_places (
    hotel_id      INT NOT NULL,
    place_id      INT NOT NULL,
    display_order INT DEFAULT 0,
    PRIMARY KEY (hotel_id, place_id),
    FOREIGN KEY (hotel_id) REFERENCES hotels(id)              ON DELETE CASCADE,
    FOREIGN KEY (place_id) REFERENCES points_of_interest(id)  ON DELETE CASCADE
);

-- Affecter tous les POI existants à l'hôtel #1
INSERT IGNORE INTO hotel_places (hotel_id, place_id)
SELECT 1, id FROM points_of_interest;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 6 — AGENDA — Multi-hôtels, workflow, récurrence, archivage
-- ════════════════════════════════════════════════════════════════

ALTER TABLE events
    ADD COLUMN hotel_id         INT  NULL,             -- NULL = événement global (super-admin)
    ADD COLUMN created_by       INT  NULL,
    ADD COLUMN status           ENUM('pending','pre_approved','published','rejected','archived') NOT NULL DEFAULT 'published',
    ADD COLUMN is_recurrent     BOOLEAN DEFAULT FALSE,
    ADD COLUMN recurrence_rule  VARCHAR(200) NULL,     -- ex: "FREQ=WEEKLY;BYDAY=MO,WE"
    ADD COLUMN auto_archive     BOOLEAN DEFAULT TRUE,  -- FALSE pour non-datés et récurrents
    ADD COLUMN archived_at      DATETIME NULL,
    ADD COLUMN validated_by     INT  NULL,
    ADD COLUMN validated_at     DATETIME NULL,
    ADD COLUMN rejection_reason VARCHAR(500) NULL;

-- Les événements existants sans date de fin sont marqués auto_archive = FALSE
UPDATE events SET auto_archive = FALSE WHERE end_date IS NULL;

-- Tous les événements existants sont publiés et globaux
UPDATE events SET status = 'published', validated_by = 1, validated_at = NOW();

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 7 — INFOS UTILES — Workflow de validation
-- ════════════════════════════════════════════════════════════════

ALTER TABLE useful_contacts
    ADD COLUMN created_by       INT  NULL,
    ADD COLUMN status           ENUM('pending','pre_approved','published','rejected') NOT NULL DEFAULT 'published',
    ADD COLUMN validated_by     INT  NULL,
    ADD COLUMN validated_at     DATETIME NULL,
    ADD COLUMN rejection_reason VARCHAR(500) NULL,
    ADD COLUMN created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE useful_contacts SET status = 'published', validated_by = 1, validated_at = NOW();

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 8 — BON À SAVOIR (remplace notifications pour le contenu hôtel)
--  notifications reste pour les alertes rotatives de la borne
-- ════════════════════════════════════════════════════════════════

-- hotel_tips = contenu éditorial "Bon à savoir" propre à chaque hôtel
-- géré exclusivement par HOTEL_ADMIN, publication immédiate sans validation
CREATE TABLE IF NOT EXISTS hotel_tips (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id      INT          NOT NULL,
    created_by    INT          NULL,
    titre_fr      VARCHAR(200) NOT NULL,
    titre_en      VARCHAR(200),
    contenu_fr    TEXT         NOT NULL,
    contenu_en    TEXT,
    categorie     VARCHAR(100),           -- ex: "Équipements", "Règles", "Horaires"
    display_order INT          DEFAULT 0,
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id)   REFERENCES hotels(id)      ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Ajouter hotel_id aux notifications rotatives existantes (borne kiosque)
ALTER TABLE notifications
    ADD COLUMN hotel_id INT NULL,
    ADD FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE;

-- Rattacher les notifications existantes à l'hôtel #1
UPDATE notifications SET hotel_id = 1 WHERE hotel_id IS NULL;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 9 — MÉTÉO — Localités par hôtel (max 5) + cache partagé
-- ════════════════════════════════════════════════════════════════

-- localities reste la table globale de référence (inchangée)
-- Nouvelle table de liaison hôtel ↔ localités (max 5 par hôtel)
CREATE TABLE IF NOT EXISTS hotel_weather_localities (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id      INT         NOT NULL,
    locality_id   INT         NOT NULL,
    display_order TINYINT     NOT NULL DEFAULT 1,   -- 1 à 5
    is_default    BOOLEAN     DEFAULT FALSE,          -- localité principale affichée par défaut
    UNIQUE KEY uq_hotel_locality (hotel_id, locality_id),
    CONSTRAINT chk_order_max CHECK (display_order BETWEEN 1 AND 5),
    FOREIGN KEY (hotel_id)    REFERENCES hotels(id)     ON DELETE CASCADE,
    FOREIGN KEY (locality_id) REFERENCES localities(id) ON DELETE RESTRICT
);

-- Affecter Ouagadougou (locality #1) à l'hôtel #1 comme localité par défaut
INSERT IGNORE INTO hotel_weather_localities (hotel_id, locality_id, display_order, is_default)
VALUES (1, 1, 1, TRUE);

-- Cache météo partagé par localité (fallback DB si Redis indisponible)
CREATE TABLE IF NOT EXISTS weather_cache (
    locality_id  INT          NOT NULL PRIMARY KEY,
    data         JSON         NOT NULL,
    fetched_at   DATETIME     NOT NULL,
    FOREIGN KEY (locality_id) REFERENCES localities(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 10 — VOLS — Aéroports avec planification par aéroport
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS airports (
    code                VARCHAR(10)  NOT NULL PRIMARY KEY,  -- Code IATA ex: "OUA"
    label               VARCHAR(200) NOT NULL,
    -- Planification
    schedule_enabled    BOOLEAN      DEFAULT TRUE,           -- FALSE = manuel uniquement
    schedule_mode       ENUM('interval','fixed_hours') DEFAULT 'interval',
    interval_minutes    INT          DEFAULT 30,             -- si mode interval
    fixed_hours         JSON         DEFAULT NULL,           -- si mode fixed_hours : [6,12,18]
    cron_expression     VARCHAR(100) DEFAULT NULL,           -- généré automatiquement à la sauvegarde
    -- Suivi
    last_fetched_at     DATETIME     DEFAULT NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Migrer la config vols existante (aéroport OUA)
INSERT IGNORE INTO airports (code, label, schedule_enabled, schedule_mode, interval_minutes, cron_expression)
SELECT
    MAX(CASE WHEN config_key = 'flight_airport_iata'     THEN config_value END),
    'Ouagadougou — Thomas Sankara International',
    CASE WHEN MAX(CASE WHEN config_key = 'flight_auto_refresh' THEN config_value END) = '1' THEN TRUE ELSE FALSE END,
    MAX(CASE WHEN config_key = 'flight_refresh_mode'    THEN config_value END),
    CAST(MAX(CASE WHEN config_key = 'flight_refresh_interval' THEN config_value END) AS UNSIGNED),
    CASE
        WHEN MAX(CASE WHEN config_key = 'flight_refresh_mode' THEN config_value END) = 'interval'
        THEN CONCAT('*/', MAX(CASE WHEN config_key = 'flight_refresh_interval' THEN config_value END), ' * * * *')
        ELSE NULL
    END
FROM theme_config;

-- Liaison aéroports → hôtels (N:N)
CREATE TABLE IF NOT EXISTS hotel_airports (
    hotel_id      INT         NOT NULL,
    airport_code  VARCHAR(10) NOT NULL,
    display_order INT         DEFAULT 0,
    PRIMARY KEY (hotel_id, airport_code),
    FOREIGN KEY (hotel_id)     REFERENCES hotels(id)   ON DELETE CASCADE,
    FOREIGN KEY (airport_code) REFERENCES airports(code) ON DELETE CASCADE
);

-- Affecter OUA à l'hôtel #1
INSERT IGNORE INTO hotel_airports (hotel_id, airport_code, display_order)
VALUES (1, 'OUA', 0);

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 11 — SUIVI CONSOMMATION API FLIGHTAPI
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS api_token_tracking (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    service         VARCHAR(50)  NOT NULL UNIQUE,   -- ex: "flightapi"
    total_tokens    INT          DEFAULT 0,          -- saisi manuellement par super-admin
    used_tokens     INT          DEFAULT 0,          -- incrémenté automatiquement à chaque appel
    alert_threshold INT          DEFAULT 100,        -- seuil d'alerte saisi manuellement
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Migrer les crédits existants
INSERT IGNORE INTO api_token_tracking (service, total_tokens, used_tokens, alert_threshold)
SELECT
    'flightapi',
    CAST(MAX(CASE WHEN config_key = 'flight_credits_limit' THEN config_value END) AS UNSIGNED),
    CAST(MAX(CASE WHEN config_key = 'flight_credits_used'  THEN config_value END) AS UNSIGNED),
    100
FROM theme_config;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 12 — AUDIT TRAIL
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NULL,
    user_role     VARCHAR(50)  NULL,
    action        VARCHAR(100) NOT NULL,  -- ex: 'create', 'update', 'delete', 'publish', 'reject'
    entity_type   VARCHAR(50)  NOT NULL,  -- ex: 'place', 'event', 'service', 'hotel_tip'
    entity_id     INT          NULL,
    old_value     JSON         NULL,
    new_value     JSON         NULL,
    ip_address    VARCHAR(45)  NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user   (user_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_date   (created_at),
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 13 — NOTIFICATIONS WORKFLOW (dashboard backoffice)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_notifications (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    recipient_id  INT          NOT NULL,            -- admin_users.id destinataire
    type          VARCHAR(50)  NOT NULL,            -- 'submission_pending', 'pre_approved', 'published', 'rejected'
    entity_type   VARCHAR(50)  NOT NULL,            -- 'place', 'event', 'useful_info'
    entity_id     INT          NOT NULL,
    message_fr    VARCHAR(500) NOT NULL,
    is_read       BOOLEAN      DEFAULT FALSE,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recipient_unread (recipient_id, is_read),
    FOREIGN KEY (recipient_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 14 — ANALYTICS — Ajouter hotel_id
-- ════════════════════════════════════════════════════════════════

ALTER TABLE analytics_events
    ADD COLUMN hotel_id INT NULL,
    ADD FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL;

UPDATE analytics_events SET hotel_id = 1 WHERE hotel_id IS NULL;

-- ════════════════════════════════════════════════════════════════
--  ÉTAPE 15 — NETTOYAGE
--  Les colonnes vols de theme_config sont désormais dans airports
--  et api_token_tracking. On conserve theme_config pour compatibilité
--  ascendante pendant la transition, mais les clés vols sont dépréciées.
-- ════════════════════════════════════════════════════════════════

-- Marquer les clés vols comme dépréciées (préfixe _deprecated_)
-- On ne supprime pas encore pour éviter une régression sur la branche main
UPDATE theme_config
SET config_key = CONCAT('_deprecated_', config_key)
WHERE config_key IN (
    'flight_airport_iata',
    'flight_refresh_interval',
    'flight_auto_refresh',
    'flight_credits_used',
    'flight_credits_limit',
    'flight_refresh_mode',
    'flight_schedule_times',
    'flight_timezone'
);

SET FOREIGN_KEY_CHECKS = 1;

-- ════════════════════════════════════════════════════════════════
--  VÉRIFICATION FINALE
-- ════════════════════════════════════════════════════════════════

SELECT 'hotels'                   AS table_name, COUNT(*) AS lignes FROM hotels
UNION ALL
SELECT 'admin_users',                            COUNT(*) FROM admin_users
UNION ALL
SELECT 'hotel_settings',                         COUNT(*) FROM hotel_settings
UNION ALL
SELECT 'service_categories',                     COUNT(*) FROM service_categories
UNION ALL
SELECT 'services',                               COUNT(*) FROM services
UNION ALL
SELECT 'service_translations',                   COUNT(*) FROM service_translations
UNION ALL
SELECT 'hotel_places',                           COUNT(*) FROM hotel_places
UNION ALL
SELECT 'hotel_weather_localities',               COUNT(*) FROM hotel_weather_localities
UNION ALL
SELECT 'weather_cache',                          COUNT(*) FROM weather_cache
UNION ALL
SELECT 'airports',                               COUNT(*) FROM airports
UNION ALL
SELECT 'hotel_airports',                         COUNT(*) FROM hotel_airports
UNION ALL
SELECT 'api_token_tracking',                     COUNT(*) FROM api_token_tracking
UNION ALL
SELECT 'audit_log',                              COUNT(*) FROM audit_log
UNION ALL
SELECT 'workflow_notifications',                 COUNT(*) FROM workflow_notifications
UNION ALL
SELECT 'hotel_tips',                             COUNT(*) FROM hotel_tips;
