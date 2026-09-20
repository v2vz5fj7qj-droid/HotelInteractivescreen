-- Migration 014 : rattacher les QR tokens à un hôtel
-- Sans cette colonne, le téléphone qui scanne le QR ne sait pas quel hôtel
-- afficher : HotelProvider n'est pas monté sur /mobile/:section et l'intercepteur
-- Axios n'injecte aucun hotel_id.
--
-- Rejouable : sur une installation neuve, `database/init.sql` crée déjà la
-- colonne hotel_id (mais pas la clé étrangère, hotels n'existant qu'à partir
-- de la migration 001). Les deux étapes sont donc conditionnées.

-- ── Colonne hotel_id (si absente) ──────────────────────────────
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'qr_tokens'
     AND COLUMN_NAME  = 'hotel_id'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE qr_tokens ADD COLUMN hotel_id INT NULL AFTER token',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Les tokens antérieurs à la migration (mono-hôtel) pointent sur l'hôtel #1
UPDATE qr_tokens SET hotel_id = 1 WHERE hotel_id IS NULL;

-- ── Clé étrangère vers hotels (si absente) ─────────────────────
SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA    = DATABASE()
     AND TABLE_NAME      = 'qr_tokens'
     AND CONSTRAINT_NAME = 'fk_qr_tokens_hotel'
);
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE qr_tokens
     ADD CONSTRAINT fk_qr_tokens_hotel
     FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
