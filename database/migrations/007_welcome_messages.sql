-- Migration 007 : ajout colonnes welcome_message_fr / welcome_message_en dans hotel_settings
ALTER TABLE hotel_settings
  ADD COLUMN welcome_message_fr TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil affiché en bannière (FR)',
  ADD COLUMN welcome_message_en TEXT NULL DEFAULT NULL COMMENT 'Message d''accueil affiché en bannière (EN)';
