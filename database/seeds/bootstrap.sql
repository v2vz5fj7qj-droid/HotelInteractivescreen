-- ════════════════════════════════════════════════════════════════════
--  ConnectBé — Données de référence (bootstrap.sql)
--
--  Le minimum pour qu'une base vierge soit exploitable : un hôtel, un compte
--  super-admin, les catégories, le thème et les compteurs d'API.
--  AUCUN contenu métier (lieux, événements, services, infos) — celui-ci vient
--  de 03_data_live.sql, qui écrase ces lignes en REPLACE INTO s'il est monté.
--
--  Tous les INSERT sont en IGNORE : le fichier est rejouable sans erreur.
-- ════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- Hôtel #1 — renommez-le depuis le backoffice
INSERT IGNORE INTO hotels (id, slug, nom) VALUES
(1, 'connectbe-ouaga', 'ConnectBé');


-- Super-admin : le hash placeholder est remplacé au démarrage du
-- backend par migration016(), à partir de la variable ADMIN_PASSWORD du .env
INSERT IGNORE INTO admin_users (id, hotel_id, email, password_hash, role) VALUES
(1, NULL, 'admin@iconnectbe.com', '$2b$10$placeholder_hash_to_replace', 'super_admin');


-- Paramètres de l'hôtel #1 (branding, horaires, wifi…)
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


-- Thème global (héritage v1, encore lu par certains écrans)
INSERT IGNORE INTO theme_config (config_key, config_value, label) VALUES
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
('idle_timeout_ms',     '60000',              'Délai inactivité avant retour menu (ms)'),
('fullscreen_password', 'fs1234',             'Mot de passe pour quitter le mode plein écran'),
('flight_airport_iata',     'OUA',   'Code IATA aéroport des vols'),
('flight_refresh_interval', '5',     'Intervalle rafraîchissement automatique vols (minutes)'),
('flight_auto_refresh',     '0',     'Rafraîchissement automatique des vols activé (0/1)'),
('flight_credits_used',     '0',                    'Crédits FlightAPI consommés depuis la dernière remise à zéro'),
('flight_credits_limit',    '30',                   'Quota de crédits FlightAPI du plan souscrit'),
('flight_refresh_mode',     'interval',             'Mode actualisation vols : interval ou schedule'),
('flight_schedule_times',   '',                     'Heures d\'actualisation programmées (virgule-séparées, ex: 6,12,18)'),
('flight_timezone',         'Africa/Ouagadougou',   'Fuseau horaire pour les heures programmées');


-- Localité météo par défaut
INSERT IGNORE INTO localities (id, name, country, owm_city_id, lat, lng, timezone, is_active, is_default, display_order)
VALUES (1, 'Ouagadougou', 'Burkina Faso', '2355426', 12.3641, -1.5332, 'Africa/Ouagadougou', 1, 1, 0);


-- Aéroports suivis pour le module Vols
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


-- Catégories de points d'intérêt
INSERT IGNORE INTO poi_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('restaurant', 'Restaurants', 'Restaurants', '🍽️', '#E8521A', 1),
('museum',     'Musées',      'Museums',     '🏛️', '#D4A843', 2),
('attraction', 'Attractions', 'Attractions', '🎯', '#8B4F12', 3),
('pharmacy',   'Pharmacies',  'Pharmacies',  '💊', '#27ae60', 4),
('hospital',   'Hôpitaux',    'Hospitals',   '🏥', '#e74c3c', 5),
('taxi',       'Taxis',       'Taxis',       '🚖', '#f39c12', 6),
('market',     'Marchés',     'Markets',     '🛍️', '#9b59b6', 7);


-- Catégories d'infos utiles
INSERT IGNORE INTO info_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('taxi',      'Taxi',       'Taxi',       '🚕', '#F59E0B', 1),
('doctor',    'Médecin',    'Doctor',     '👨‍⚕️', '#3B82F6', 2),
('pharmacy',  'Pharmacie',  'Pharmacy',   '💊', '#10B981', 3),
('shuttle',   'Navette',    'Shuttle',    '🚌', '#8B5CF6', 4),
('emergency', 'Urgences',   'Emergency',  '🚨', '#EF4444', 5),
('embassy',   'Ambassade',  'Embassy',    '🏛️', '#6366F1', 6),
('bank',      'Banque',     'Bank',       '🏦', '#0EA5E9', 7);


-- Catégories d'événements
INSERT IGNORE INTO event_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('culture',     'Culture',     'Culture',     '🎭', '#8B5CF6', 1),
('music',       'Musique',     'Music',       '🎵', '#EC4899', 2),
('sport',       'Sport',       'Sport',       '🏃', '#10B981', 3),
('gastronomy',  'Gastronomie', 'Gastronomy',  '🍽️', '#F59E0B', 4),
('festival',    'Festival',    'Festival',    '🎉', '#EF4444', 5),
('exhibition',  'Exposition',  'Exhibition',  '🖼️', '#3B82F6', 6),
('hotel',       'Hôtel',       'Hotel',       '🏨', '#C2782A', 7);


-- Catégories de services
INSERT IGNORE INTO service_categories (id, hotel_id, label_fr, label_en, icon, display_order) VALUES
(1, NULL, 'Spa & Bien-être',   'Spa & Wellness',   '🧖', 1),
(2, NULL, 'Restauration',      'Dining',           '🍽️', 2),
(3, NULL, 'Sport & Piscine',   'Sport & Pool',     '🏊', 3),
(4, NULL, 'Transport',         'Transport',        '🚗', 4),
(5, NULL, 'Loisirs',           'Leisure',          '🎯', 5);


-- Bandeau de notifications d'accueil
INSERT IGNORE INTO notifications (message_fr, message_en, display_order) VALUES
('Cocktail de bienvenue ce soir à 18h au bar rooftop',   'Welcome cocktail tonight at 6pm at the rooftop bar', 1),
('Navette aéroport disponible — Contactez la réception', 'Airport shuttle available — Contact reception',       2),
('Petit-déjeuner servi de 6h30 à 10h30',                 'Breakfast served from 6:30am to 10:30am',            3);


-- Compteurs de quotas des API externes
INSERT IGNORE INTO api_token_tracking (service, total_tokens, used_tokens, alert_threshold)
SELECT
    'flightapi',
    CAST(MAX(CASE WHEN config_key = 'flight_credits_limit' THEN config_value END) AS UNSIGNED),
    CAST(MAX(CASE WHEN config_key = 'flight_credits_used'  THEN config_value END) AS UNSIGNED),
    100
FROM theme_config;


SET FOREIGN_KEY_CHECKS = 1;
