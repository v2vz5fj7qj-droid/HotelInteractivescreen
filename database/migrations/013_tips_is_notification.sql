-- Migration 013 : ajoute le flag is_notification sur hotel_tips
-- Un "Bon à savoir" coché s'affiche avec l'icône clochette sur la borne

ALTER TABLE hotel_tips
  ADD COLUMN is_notification TINYINT(1) NOT NULL DEFAULT 0
  AFTER is_active;
