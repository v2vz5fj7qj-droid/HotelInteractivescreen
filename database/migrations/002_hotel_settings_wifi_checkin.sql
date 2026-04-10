-- ════════════════════════════════════════════════════════════════
--  ConnectBé — Migration 002 : WiFi + Check-in/out dans hotel_settings
--  Date : 2026-04-10
--
--  EXÉCUTION :
--    docker exec -i connectbe_mysql mysql \
--      -u connectbe_user -pchange_me_db connectbe_kiosk \
--      < database/migrations/002_hotel_settings_wifi_checkin.sql
-- ════════════════════════════════════════════════════════════════

ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS wifi_name      VARCHAR(100) DEFAULT NULL;
ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS wifi_password  VARCHAR(100) DEFAULT NULL;
ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS checkin_time   TIME         DEFAULT NULL;
ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS checkout_time  TIME         DEFAULT NULL;
