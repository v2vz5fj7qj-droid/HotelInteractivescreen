-- Migration 004 : traductions supplémentaires des tips (colonne JSON)
--
-- MySQL 8.0 ne connaît pas `ADD COLUMN IF NOT EXISTS` (syntaxe MariaDB) : chaque
-- ajout est conditionné par une lecture d'information_schema, ce qui rend le
-- fichier rejouable sans erreur.
--
-- Les colonnes titre_fr/titre_en/contenu_fr/contenu_en restent en place pour la
-- rétrocompatibilité. Les autres langues (de, es, pt, ar, zh, ja, ru) vivent dans
-- translations_json, au format { "de": { "titre": "…", "contenu": "…" }, … }


SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tips' AND COLUMN_NAME = 'translations_json');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE hotel_tips ADD COLUMN translations_json TEXT NULL DEFAULT NULL COMMENT ''JSON des traductions supplémentaires hors FR/EN''', 'DO 0');
PREPARE st1 FROM @s1; EXECUTE st1; DEALLOCATE PREPARE st1;
