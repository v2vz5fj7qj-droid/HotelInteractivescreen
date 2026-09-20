-- Migration 002 : WiFi + check-in/out dans hotel_settings
--
-- MySQL 8.0 ne connaît pas `ADD COLUMN IF NOT EXISTS` (syntaxe MariaDB) : chaque
-- ajout est conditionné par une lecture d'information_schema, ce qui rend le
-- fichier rejouable sans erreur.
--
-- EXÉCUTION :
--   docker exec -i connectbe_mysql mysql \
--     -u connectbe_user -pchange_me_db connectbe_kiosk \
--     < database/migrations/002_hotel_settings_wifi_checkin.sql


SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_settings' AND COLUMN_NAME = 'wifi_name');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE hotel_settings ADD COLUMN wifi_name VARCHAR(100) DEFAULT NULL', 'DO 0');
PREPARE st1 FROM @s1; EXECUTE st1; DEALLOCATE PREPARE st1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_settings' AND COLUMN_NAME = 'wifi_password');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE hotel_settings ADD COLUMN wifi_password VARCHAR(100) DEFAULT NULL', 'DO 0');
PREPARE st2 FROM @s2; EXECUTE st2; DEALLOCATE PREPARE st2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_settings' AND COLUMN_NAME = 'checkin_time');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE hotel_settings ADD COLUMN checkin_time TIME DEFAULT NULL', 'DO 0');
PREPARE st3 FROM @s3; EXECUTE st3; DEALLOCATE PREPARE st3;

SET @c4 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_settings' AND COLUMN_NAME = 'checkout_time');
SET @s4 := IF(@c4 = 0, 'ALTER TABLE hotel_settings ADD COLUMN checkout_time TIME DEFAULT NULL', 'DO 0');
PREPARE st4 FROM @s4; EXECUTE st4; DEALLOCATE PREPARE st4;
