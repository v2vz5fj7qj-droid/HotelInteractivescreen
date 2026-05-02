-- Migration 010 : table des évaluations hôtel (feedbacks kiosque)
CREATE TABLE IF NOT EXISTS feedbacks (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id     INT NOT NULL,
  categories   JSON NOT NULL COMMENT '{"proprete":4,"accueil":5,"chambre":3,"restauration":4,"services":5}',
  commentaire  TEXT NULL,
  note_globale DECIMAL(3,2) NOT NULL,
  locale       VARCHAR(5) NOT NULL DEFAULT 'fr',
  ip           VARCHAR(45) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  INDEX idx_feedbacks_hotel_date (hotel_id, created_at)
);
