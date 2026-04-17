-- ════════════════════════════════════════════════════════════════
--  Migration 006 — Liaison N:N useful_contacts ↔ hotels
--  Les infos utiles n'avaient aucune notion d'hôtel.
--  Cette migration ajoute :
--    - owner_hotel_id  (hôtel créateur, NULL = super-admin / global)
--    - hotel_info      (table de liaison N:N pour la diffusion)
--  Toutes les infos existantes sont affectées à l'hôtel #1 par défaut.
--
--  EXÉCUTION :
--    docker exec -i connectbe_mysql mysql \
--      -u connectbe_user -pchange_me_db connectbe_kiosk \
--      < database/migrations/006_hotel_info_nn.sql
-- ════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Ajouter owner_hotel_id à useful_contacts ───────────────────
ALTER TABLE useful_contacts
    ADD COLUMN owner_hotel_id INT NULL DEFAULT NULL,
    ADD CONSTRAINT fk_uc_owner_hotel
        FOREIGN KEY (owner_hotel_id) REFERENCES hotels(id) ON DELETE SET NULL;

-- ── 2. Table de liaison useful_contacts ↔ hotels ─────────────────
CREATE TABLE IF NOT EXISTS hotel_info (
    hotel_id      INT NOT NULL,
    info_id       INT NOT NULL,
    display_order INT DEFAULT 0,
    PRIMARY KEY (hotel_id, info_id),
    FOREIGN KEY (hotel_id) REFERENCES hotels(id)          ON DELETE CASCADE,
    FOREIGN KEY (info_id)  REFERENCES useful_contacts(id) ON DELETE CASCADE
);

-- ── 3. Toutes les infos existantes → hôtel #1 ────────────────────
INSERT IGNORE INTO hotel_info (hotel_id, info_id)
SELECT 1, id FROM useful_contacts;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Vérification ─────────────────────────────────────────────────
SELECT 'hotel_info créée' AS info, COUNT(*) AS lignes FROM hotel_info;
SELECT 'useful_contacts.owner_hotel_id' AS info,
       COUNT(*) AS avec_proprietaire FROM useful_contacts WHERE owner_hotel_id IS NOT NULL;
