-- ════════════════════════════════════════════════
--  ConnectBé — Schéma MySQL
-- ════════════════════════════════════════════════

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ─────────────────────────────────────────────────
--  THÈME / CHARTE GRAPHIQUE (modifiable via admin)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS theme_config (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    config_key    VARCHAR(80)  NOT NULL UNIQUE,
    config_value  TEXT         NOT NULL,
    label         VARCHAR(150),
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO theme_config (config_key, config_value, label) VALUES
('hotel_name',          'ConnectBé',          'Nom de l\'hôtel'),
('color_primary',       '#C2782A',            'Couleur primaire (boutons, accents)'),
('color_primary_dark',  '#8B4F12',            'Couleur primaire foncée (hover)'),
('color_secondary',     '#D4A843',            'Couleur secondaire (or)'),
('color_bg_dark',       '#1A1208',            'Fond mode sombre'),
('color_bg_light',      '#FDF6EC',            'Fond mode clair'),
('color_surface_dark',  '#2C1E0A',            'Surface mode sombre'),
('color_surface_light', '#FFFFFF',            'Surface mode clair'),
('color_text_dark',     '#F5E6C8',            'Texte mode sombre'),
('color_text_light',    '#2C1A06',            'Texte mode clair'),
('color_accent',        '#E8521A',            'Couleur accent (alertes, CTA)'),
('font_primary',        'Poppins',            'Police principale'),
('font_secondary',      'Playfair Display',   'Police titres'),
('logo_url',            '/images/logo.png',   'URL du logo hôtel'),
('logo_url_dark',       '/images/logo-dark.png', 'Logo pour fond sombre'),
('banner_image_url',    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80', 'Image de fond bannière accueil'),
('idle_timeout_ms',     '30000',              'Délai inactivité avant retour menu (ms)'),
('fullscreen_password', 'fs1234',             'Mot de passe pour quitter le mode plein écran'),
('flight_airport_iata',     'OUA',   'Code IATA aéroport des vols'),
('flight_refresh_interval', '5',     'Intervalle rafraîchissement automatique vols (minutes)'),
('flight_auto_refresh',     '0',     'Rafraîchissement automatique des vols activé (0/1)'),
('flight_credits_used',     '0',                    'Crédits FlightAPI consommés depuis la dernière remise à zéro'),
('flight_credits_limit',    '30',                   'Quota de crédits FlightAPI du plan souscrit'),
('flight_refresh_mode',     'interval',             'Mode actualisation vols : interval ou schedule'),
('flight_schedule_times',   '',                     'Heures d\'actualisation programmées (virgule-séparées, ex: 6,12,18)'),
('flight_timezone',         'Africa/Ouagadougou',   'Fuseau horaire pour les heures programmées');

-- ─────────────────────────────────────────────────
--  SERVICES BIEN-ÊTRE
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellness_services (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(100) NOT NULL UNIQUE,
    duration_min INT          NOT NULL,
    price_fcfa   INT          NOT NULL,
    image_url    VARCHAR(255),
    video_url    VARCHAR(255),
    contact_phone VARCHAR(20),
    booking_info  TEXT,                -- Instructions pour réserver (ex: "Appeler le poste 201")
    available_hours VARCHAR(100),      -- ex: "08:00-20:00"
    available_days  VARCHAR(100),      -- ex: "Lun-Dim"
    max_per_day  INT DEFAULT 10,
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wellness_service_translations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    service_id  INT        NOT NULL,
    locale      VARCHAR(5) NOT NULL,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    benefits    TEXT,                  -- Points forts (affiché sous forme de liste)
    FOREIGN KEY (service_id) REFERENCES wellness_services(id) ON DELETE CASCADE,
    UNIQUE KEY uq_service_locale (service_id, locale)
);

-- ─────────────────────────────────────────────────
--  CATÉGORIES POI (gérées via backoffice)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poi_categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    key_name     VARCHAR(50)  NOT NULL UNIQUE,
    label_fr     VARCHAR(100) NOT NULL,
    label_en     VARCHAR(100) NOT NULL,
    icon         VARCHAR(10)  NOT NULL DEFAULT '📍',
    color        VARCHAR(7)   NOT NULL DEFAULT '#C2782A',
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO poi_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('restaurant', 'Restaurants', 'Restaurants', '🍽️', '#E8521A', 1),
('museum',     'Musées',      'Museums',     '🏛️', '#D4A843', 2),
('attraction', 'Attractions', 'Attractions', '🎯', '#8B4F12', 3),
('pharmacy',   'Pharmacies',  'Pharmacies',  '💊', '#27ae60', 4),
('hospital',   'Hôpitaux',    'Hospitals',   '🏥', '#e74c3c', 5),
('taxi',       'Taxis',       'Taxis',       '🚖', '#f39c12', 6),
('market',     'Marchés',     'Markets',     '🛍️', '#9b59b6', 7);

-- ─────────────────────────────────────────────────
--  POINTS D'INTÉRÊT (Carte)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_of_interest (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    category    VARCHAR(50) NOT NULL,
    lat         DECIMAL(10,7) NOT NULL,
    lng         DECIMAL(10,7) NOT NULL,
    phone       VARCHAR(30),
    website     VARCHAR(255),
    rating      DECIMAL(2,1),
    price_level TINYINT,               -- 1=€ 2=€€ 3=€€€
    is_active   BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poi_translations (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    poi_id   INT        NOT NULL,
    locale   VARCHAR(5) NOT NULL,
    name     VARCHAR(150) NOT NULL,
    address  VARCHAR(255),
    description TEXT,
    FOREIGN KEY (poi_id) REFERENCES points_of_interest(id) ON DELETE CASCADE,
    UNIQUE KEY uq_poi_locale (poi_id, locale)
);

CREATE TABLE IF NOT EXISTS poi_images (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    poi_id        INT          NOT NULL,
    url           VARCHAR(255) NOT NULL,
    display_order TINYINT      DEFAULT 0,
    FOREIGN KEY (poi_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────
--  CATÉGORIES INFOS UTILES (gérées via backoffice)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS info_categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    key_name     VARCHAR(50)  NOT NULL UNIQUE,
    label_fr     VARCHAR(100) NOT NULL,
    label_en     VARCHAR(100) NOT NULL,
    icon         VARCHAR(10)  NOT NULL DEFAULT '📋',
    color        VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO info_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('taxi',      'Taxi',       'Taxi',       '🚕', '#F59E0B', 1),
('doctor',    'Médecin',    'Doctor',     '👨‍⚕️', '#3B82F6', 2),
('pharmacy',  'Pharmacie',  'Pharmacy',   '💊', '#10B981', 3),
('shuttle',   'Navette',    'Shuttle',    '🚌', '#8B5CF6', 4),
('emergency', 'Urgences',   'Emergency',  '🚨', '#EF4444', 5),
('embassy',   'Ambassade',  'Embassy',    '🏛️', '#6366F1', 6),
('bank',      'Banque',     'Bank',       '🏦', '#0EA5E9', 7);

-- ─────────────────────────────────────────────────
--  INFOS UTILES (contacts, taxis, etc.)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS useful_contacts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    category     VARCHAR(50) NOT NULL,
    phone        VARCHAR(30),
    whatsapp     VARCHAR(30),
    website      VARCHAR(255),
    available_24h BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS useful_contact_translations (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT        NOT NULL,
    locale     VARCHAR(5) NOT NULL,
    name       VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    address    VARCHAR(255),
    FOREIGN KEY (contact_id) REFERENCES useful_contacts(id) ON DELETE CASCADE,
    UNIQUE KEY uq_contact_locale (contact_id, locale)
);

-- ─────────────────────────────────────────────────
--  CATÉGORIES ÉVÉNEMENTS (gérées via backoffice)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    key_name     VARCHAR(50)  NOT NULL UNIQUE,
    label_fr     VARCHAR(100) NOT NULL,
    label_en     VARCHAR(100) NOT NULL,
    icon         VARCHAR(10)  NOT NULL DEFAULT '🗓️',
    color        VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO event_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('culture',     'Culture',     'Culture',     '🎭', '#8B5CF6', 1),
('music',       'Musique',     'Music',       '🎵', '#EC4899', 2),
('sport',       'Sport',       'Sport',       '🏃', '#10B981', 3),
('gastronomy',  'Gastronomie', 'Gastronomy',  '🍽️', '#F59E0B', 4),
('festival',    'Festival',    'Festival',    '🎉', '#EF4444', 5),
('exhibition',  'Exposition',  'Exhibition',  '🖼️', '#3B82F6', 6),
('hotel',       'Hôtel',       'Hotel',       '🏨', '#C2782A', 7);

-- ─────────────────────────────────────────────────
--  ÉVÉNEMENTS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(120) NOT NULL UNIQUE,
    category     VARCHAR(50)  NOT NULL,
    start_date   DATE         NOT NULL,
    end_date     DATE,
    start_time   TIME,
    end_time     TIME,
    location     VARCHAR(200),
    lat          DECIMAL(10,7),
    lng          DECIMAL(10,7),
    price_fcfa   INT DEFAULT 0,
    image_url    VARCHAR(255),
    is_featured  BOOLEAN DEFAULT FALSE,
    is_active    BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_start_date (start_date),
    INDEX idx_category   (category)
);

CREATE TABLE IF NOT EXISTS event_translations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    event_id    INT        NOT NULL,
    locale      VARCHAR(5) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    tags        VARCHAR(255),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY uq_event_locale (event_id, locale)
);

-- ─────────────────────────────────────────────────
--  NOTIFICATIONS (Bon à savoir — gérées en backoffice)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    message_fr    VARCHAR(500) NOT NULL,
    message_en    VARCHAR(500),
    message_de    VARCHAR(500),
    message_es    VARCHAR(500),
    message_pt    VARCHAR(500),
    message_ar    VARCHAR(500),
    message_zh    VARCHAR(500),
    message_ja    VARCHAR(500),
    message_ru    VARCHAR(500),
    is_active     BOOLEAN DEFAULT TRUE,
    display_order INT     DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
);

INSERT INTO notifications (message_fr, message_en, display_order) VALUES
('Cocktail de bienvenue ce soir à 18h au bar rooftop',   'Welcome cocktail tonight at 6pm at the rooftop bar', 1),
('Navette aéroport disponible — Contactez la réception', 'Airport shuttle available — Contact reception',       2),
('Petit-déjeuner servi de 6h30 à 10h30',                 'Breakfast served from 6:30am to 10:30am',            3);

-- ─────────────────────────────────────────────────
--  ANALYTICS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    section     VARCHAR(50) NOT NULL,
    action      VARCHAR(50),
    meta        JSON,
    locale      VARCHAR(5),
    device_type ENUM('kiosk','mobile') DEFAULT 'kiosk',
    session_id  VARCHAR(36),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_section (section),
    INDEX idx_created (created_at),
    INDEX idx_section_date (section, created_at)
);

-- ── Localités météo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS localities (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  country       VARCHAR(60)  NOT NULL DEFAULT 'Burkina Faso',
  owm_city_id   VARCHAR(20),
  lat           DECIMAL(9,6),
  lng           DECIMAL(9,6),
  timezone      VARCHAR(50)  DEFAULT 'Africa/Ouagadougou',
  is_active     BOOLEAN      DEFAULT TRUE,
  is_default    BOOLEAN      DEFAULT FALSE,
  display_order INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO localities (id, name, country, owm_city_id, lat, lng, timezone, is_active, is_default, display_order)
VALUES (1, 'Ouagadougou', 'Burkina Faso', '2355426', 12.3641, -1.5332, 'Africa/Ouagadougou', 1, 1, 0);

-- ─────────────────────────────────────────────────
--  TOKENS QR CODE (validité temporaire)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_tokens (
    token       CHAR(36)     PRIMARY KEY,
    section     VARCHAR(50)  NOT NULL,
    locale      VARCHAR(5)   NOT NULL DEFAULT 'fr',
    expires_at  DATETIME     NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_qr_expires (expires_at)
);
