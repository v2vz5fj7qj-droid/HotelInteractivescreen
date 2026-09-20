-- Migration 011 : colonne font_file_url dans hotel_settings
--
-- MySQL 8.0 ne connaît pas `ADD COLUMN IF NOT EXISTS` (syntaxe MariaDB) : chaque
-- ajout est conditionné par une lecture d'information_schema, ce qui rend le
-- fichier rejouable sans erreur.


SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_settings' AND COLUMN_NAME = 'font_file_url');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE hotel_settings ADD COLUMN font_file_url VARCHAR(500) NULL DEFAULT NULL COMMENT ''URL du fichier .ttf/.otf custom uploadé pour la police de l hôtel''', 'DO 0');
PREPARE st1 FROM @s1; EXECUTE st1; DEALLOCATE PREPARE st1;
