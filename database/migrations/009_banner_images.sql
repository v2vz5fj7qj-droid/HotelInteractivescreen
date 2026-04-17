-- Migration 009 : galerie d'images de bannière par hôtel (max 10)
CREATE TABLE IF NOT EXISTS hotel_banner_images (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id      INT NOT NULL,
  url           VARCHAR(500) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  INDEX idx_hotel_banner (hotel_id, display_order)
);
