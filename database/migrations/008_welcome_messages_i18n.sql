-- Migration 008 : messages d'accueil dans toutes les langues du kiosque
ALTER TABLE hotel_settings
  ADD COLUMN welcome_message_de TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (DE)',
  ADD COLUMN welcome_message_es TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (ES)',
  ADD COLUMN welcome_message_pt TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (PT)',
  ADD COLUMN welcome_message_ar TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (AR)',
  ADD COLUMN welcome_message_zh TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (ZH)',
  ADD COLUMN welcome_message_ja TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (JA)',
  ADD COLUMN welcome_message_ru TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil (RU)';
