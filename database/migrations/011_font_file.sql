-- Migration 011 : colonne font_file_url dans hotel_settings
ALTER TABLE hotel_settings
  ADD COLUMN IF NOT EXISTS font_file_url VARCHAR(500) NULL DEFAULT NULL
    COMMENT 'URL du fichier .ttf/.otf custom uploadé pour la police de l\'hôtel';
