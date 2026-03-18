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
('idle_timeout_ms',     '30000',              'Délai inactivité avant retour menu (ms)');

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
--  POINTS D'INTÉRÊT (Carte)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_of_interest (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    category    ENUM('restaurant','museum','pharmacy','taxi',
                     'hospital','attraction','market','hotel',
                     'bank','mosque','church') NOT NULL,
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

-- ─────────────────────────────────────────────────
--  INFOS UTILES (contacts, taxis, etc.)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS useful_contacts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    category     ENUM('taxi','doctor','pharmacy','shuttle',
                      'emergency','embassy','bank') NOT NULL,
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
