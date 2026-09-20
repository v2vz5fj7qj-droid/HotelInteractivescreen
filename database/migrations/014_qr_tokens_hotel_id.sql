-- Migration 014 : rattacher les QR tokens à un hôtel
-- Sans cette colonne, le téléphone qui scanne le QR ne sait pas quel hôtel
-- afficher : HotelProvider n'est pas monté sur /mobile/:section et l'intercepteur
-- Axios n'injecte aucun hotel_id.
ALTER TABLE qr_tokens
  ADD COLUMN hotel_id INT NULL AFTER token;

-- Les tokens antérieurs à la migration (mono-hôtel) pointent sur l'hôtel #1
UPDATE qr_tokens SET hotel_id = 1 WHERE hotel_id IS NULL;

ALTER TABLE qr_tokens
  ADD CONSTRAINT fk_qr_tokens_hotel
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE;
