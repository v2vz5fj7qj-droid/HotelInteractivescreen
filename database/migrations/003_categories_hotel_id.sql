-- ════════════════════════════════════════════════════════════════
--  Migration 003 — Gestion des catégories par hôtel
--
--  Ajoute hotel_id et created_by à poi_categories, event_categories et
--  info_categories, pour permettre des catégories propres à un hôtel.
--  NULL = catégorie globale partagée par tous les hôtels.
--
--  L'unicité passe de (key_name) à (key_name, hotel_id) : deux hôtels peuvent
--  définir une catégorie de même clé.
--
--  MySQL 8.0 ne connaît ni `ADD COLUMN IF NOT EXISTS` ni `DROP INDEX IF EXISTS`
--  (syntaxe MariaDB) : chaque opération est conditionnée par une lecture
--  d'information_schema, ce qui rend le fichier rejouable sans erreur.
-- ════════════════════════════════════════════════════════════════


-- ── Catégories points d'intérêt ──────────────────────────────────

SET @v1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'poi_categories' AND COLUMN_NAME = 'hotel_id');
SET @q1 := IF(@v1 = 0, 'ALTER TABLE poi_categories ADD COLUMN hotel_id INT NULL DEFAULT NULL', 'DO 0');
PREPARE p1 FROM @q1; EXECUTE p1; DEALLOCATE PREPARE p1;

SET @v2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'poi_categories' AND COLUMN_NAME = 'created_by');
SET @q2 := IF(@v2 = 0, 'ALTER TABLE poi_categories ADD COLUMN created_by INT NULL DEFAULT NULL', 'DO 0');
PREPARE p2 FROM @q2; EXECUTE p2; DEALLOCATE PREPARE p2;

-- Ancien index simple, présent sur les bases antérieures au multi-hôtel

SET @v3 := (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'poi_categories' AND INDEX_NAME = 'key_name');
SET @q3 := IF(@v3 > 0, 'ALTER TABLE poi_categories DROP INDEX `key_name`', 'DO 0');
PREPARE p3 FROM @q3; EXECUTE p3; DEALLOCATE PREPARE p3;

SET @v4 := (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'poi_categories' AND INDEX_NAME = 'uq_poi_cat_key_hotel');
SET @q4 := IF(@v4 = 0, 'ALTER TABLE poi_categories ADD UNIQUE KEY `uq_poi_cat_key_hotel` (key_name, hotel_id)', 'DO 0');
PREPARE p4 FROM @q4; EXECUTE p4; DEALLOCATE PREPARE p4;


-- ── Catégories événements ──────────────────────────────────

SET @v5 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_categories' AND COLUMN_NAME = 'hotel_id');
SET @q5 := IF(@v5 = 0, 'ALTER TABLE event_categories ADD COLUMN hotel_id INT NULL DEFAULT NULL', 'DO 0');
PREPARE p5 FROM @q5; EXECUTE p5; DEALLOCATE PREPARE p5;

SET @v6 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_categories' AND COLUMN_NAME = 'created_by');
SET @q6 := IF(@v6 = 0, 'ALTER TABLE event_categories ADD COLUMN created_by INT NULL DEFAULT NULL', 'DO 0');
PREPARE p6 FROM @q6; EXECUTE p6; DEALLOCATE PREPARE p6;

-- Ancien index simple, présent sur les bases antérieures au multi-hôtel

SET @v7 := (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_categories' AND INDEX_NAME = 'key_name');
SET @q7 := IF(@v7 > 0, 'ALTER TABLE event_categories DROP INDEX `key_name`', 'DO 0');
PREPARE p7 FROM @q7; EXECUTE p7; DEALLOCATE PREPARE p7;

SET @v8 := (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_categories' AND INDEX_NAME = 'uq_event_cat_key_hotel');
SET @q8 := IF(@v8 = 0, 'ALTER TABLE event_categories ADD UNIQUE KEY `uq_event_cat_key_hotel` (key_name, hotel_id)', 'DO 0');
PREPARE p8 FROM @q8; EXECUTE p8; DEALLOCATE PREPARE p8;


-- ── Catégories infos utiles ──────────────────────────────────

SET @v9 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'info_categories' AND COLUMN_NAME = 'hotel_id');
SET @q9 := IF(@v9 = 0, 'ALTER TABLE info_categories ADD COLUMN hotel_id INT NULL DEFAULT NULL', 'DO 0');
PREPARE p9 FROM @q9; EXECUTE p9; DEALLOCATE PREPARE p9;

SET @v10 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'info_categories' AND COLUMN_NAME = 'created_by');
SET @q10 := IF(@v10 = 0, 'ALTER TABLE info_categories ADD COLUMN created_by INT NULL DEFAULT NULL', 'DO 0');
PREPARE p10 FROM @q10; EXECUTE p10; DEALLOCATE PREPARE p10;

-- Ancien index simple, présent sur les bases antérieures au multi-hôtel

SET @v11 := (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'info_categories' AND INDEX_NAME = 'key_name');
SET @q11 := IF(@v11 > 0, 'ALTER TABLE info_categories DROP INDEX `key_name`', 'DO 0');
PREPARE p11 FROM @q11; EXECUTE p11; DEALLOCATE PREPARE p11;

SET @v12 := (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'info_categories' AND INDEX_NAME = 'uq_info_cat_key_hotel');
SET @q12 := IF(@v12 = 0, 'ALTER TABLE info_categories ADD UNIQUE KEY `uq_info_cat_key_hotel` (key_name, hotel_id)', 'DO 0');
PREPARE p12 FROM @q12; EXECUTE p12; DEALLOCATE PREPARE p12;
