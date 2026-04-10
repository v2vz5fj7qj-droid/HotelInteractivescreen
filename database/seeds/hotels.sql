-- ════════════════════════════════════════════════════════════════
--  ConnectBé — Seed : 3 hôtels (ConnectBé + 2 fictifs)
--  Date : 2026-04-10
--
--  EXÉCUTION :
--    docker exec -i connectbe_mysql mysql \
--      -u connectbe_user -pchange_me_db connectbe_kiosk \
--      < database/seeds/hotels.sql
-- ════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Renommer le slug de l'hôtel existant ───────────────────
UPDATE hotels SET slug = 'connectbe' WHERE id = 1 AND slug = 'connectbe-ouaga';

-- ── 2. Hôtels fictifs ─────────────────────────────────────────
INSERT IGNORE INTO hotels (id, slug, nom, is_active) VALUES
(2, 'azalai',   'Hôtel Azalai Indépendance', 1),
(3, 'silmande', 'Résidence Silmandé',         1);

-- ── 3. hotel_settings pour l'hôtel #2 (Azalai) ───────────────
INSERT IGNORE INTO hotel_settings (
    hotel_id, nom, logo_url, logo_url_dark, background_url,
    theme_colors, font_primary, font_secondary,
    adresse, telephone, email_contact, lat, lng,
    idle_timeout_ms, fullscreen_password
) VALUES (
    2,
    'Hôtel Azalai Indépendance',
    '/images/logo.png',
    '/images/logo-dark.png',
    NULL,
    JSON_OBJECT(
        'color_primary',       '#1A5276',
        'color_primary_dark',  '#0E2F4A',
        'color_secondary',     '#2E86C1',
        'color_bg_dark',       '#0A1A2A',
        'color_bg_light',      '#EBF5FB',
        'color_surface_dark',  '#152B3F',
        'color_surface_light', '#FFFFFF',
        'color_text_dark',     '#D6EAF8',
        'color_text_light',    '#1A2D40',
        'color_accent',        '#F39C12'
    ),
    'Poppins',
    'Playfair Display',
    'Avenue Kwame N''Krumah, Ouagadougou',
    '+226 25 30 60 20',
    'contact@azalai-ouaga.bf',
    12.3624,
    -1.5336,
    30000,
    'fs1234'
);

-- ── 4. hotel_settings pour l'hôtel #3 (Silmandé) ────────────
INSERT IGNORE INTO hotel_settings (
    hotel_id, nom, logo_url, logo_url_dark, background_url,
    theme_colors, font_primary, font_secondary,
    adresse, telephone, email_contact, lat, lng,
    idle_timeout_ms, fullscreen_password
) VALUES (
    3,
    'Résidence Silmandé',
    '/images/logo.png',
    '/images/logo-dark.png',
    NULL,
    JSON_OBJECT(
        'color_primary',       '#1E8449',
        'color_primary_dark',  '#145A32',
        'color_secondary',     '#27AE60',
        'color_bg_dark',       '#0A1A0F',
        'color_bg_light',      '#EAFAF1',
        'color_surface_dark',  '#163A20',
        'color_surface_light', '#FFFFFF',
        'color_text_dark',     '#D5F5E3',
        'color_text_light',    '#1A3A22',
        'color_accent',        '#E67E22'
    ),
    'Poppins',
    'Montserrat',
    'Rue du Marché, Ouagadougou',
    '+226 25 36 21 00',
    'info@silmande.bf',
    12.3701,
    -1.5289,
    30000,
    'fs1234'
);

SET FOREIGN_KEY_CHECKS = 1;
