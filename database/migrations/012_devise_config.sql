-- ════════════════════════════════════════════════════════════════
--  Migration 012 — table devise_config : convertisseur de devises par hôtel
--
--  MySQL 8.0 refuse une valeur par défaut littérale sur une colonne JSON
--  (ERROR 1101). target_currencies est donc NOT NULL sans défaut : la valeur
--  initiale est posée par l'application à la création de la config.
--
--  Rejouable : CREATE TABLE IF NOT EXISTS, puis ajout conditionnel de
--  display_currencies pour les bases où la table existe déjà sans elle.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS devise_config (
  id                    INT          NOT NULL AUTO_INCREMENT,
  hotel_id              INT          NOT NULL,
  base_currency         VARCHAR(3)   NOT NULL DEFAULT 'XOF',
  target_currencies     JSON         NOT NULL,
  display_currencies    JSON         NULL DEFAULT NULL
    COMMENT 'Sous-ensemble max 5 devises affichées sur le tableau des taux',
  update_mode           ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  update_interval_hours INT          NOT NULL DEFAULT 6
    COMMENT 'En mode auto : intervalle en heures entre deux mises à jour (1–24)',
  daily_update_times    JSON         NULL DEFAULT NULL
    COMMENT 'En mode auto : liste d''heures quotidiennes ex ["09:00","15:00"]',
  rates                 JSON         NULL DEFAULT NULL
    COMMENT 'Taux stockés {"EUR":0.0015,"USD":0.0016,...}',
  last_update           TIMESTAMP    NULL DEFAULT NULL,
  api_provider          VARCHAR(50)  NOT NULL DEFAULT 'open.er-api.com',
  api_key               VARCHAR(255) NULL DEFAULT NULL
    COMMENT 'Clé API optionnelle pour les fournisseurs payants',
  PRIMARY KEY (id),
  UNIQUE KEY uk_hotel (hotel_id),
  CONSTRAINT fk_devise_hotel FOREIGN KEY (hotel_id)
    REFERENCES hotels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bases où devise_config précède l'ajout de display_currencies
SET @v1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devise_config' AND COLUMN_NAME = 'display_currencies');
SET @q1 := IF(@v1 = 0,
  'ALTER TABLE devise_config ADD COLUMN display_currencies JSON NULL DEFAULT NULL COMMENT ''Sous-ensemble max 5 devises affichées sur le tableau des taux'' AFTER target_currencies',
  'DO 0');
PREPARE p1 FROM @q1; EXECUTE p1; DEALLOCATE PREPARE p1;
