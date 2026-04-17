-- ════════════════════════════════════════════════════════════════
--  Migration 005 — Liaison N:N events ↔ hotels
--  Remplace le champ monovalué events.hotel_id par une table
--  de liaison hotel_events permettant à un événement d'être
--  affiché sur plusieurs hôtels simultanément.
--
--  IMPORTANT : events.hotel_id est renommé en owner_hotel_id
--  (hôtel propriétaire / créateur) et reste nullable.
--  La colonne hotel_nom dans les requêtes super/events est
--  désormais construite depuis hotel_events (premier hôtel associé).
--
--  EXÉCUTION :
--    docker exec -i connectbe_mysql mysql \
--      -u connectbe_user -pchange_me_db connectbe_kiosk \
--      < database/migrations/005_hotel_events_nn.sql
-- ════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Table de liaison events ↔ hotels ──────────────────────────
CREATE TABLE IF NOT EXISTS hotel_events (
    hotel_id      INT NOT NULL,
    event_id      INT NOT NULL,
    display_order INT DEFAULT 0,
    PRIMARY KEY (hotel_id, event_id),
    FOREIGN KEY (hotel_id)  REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE CASCADE
);

-- ── 2. Migrer les affectations depuis events.hotel_id ────────────
-- Tous les événements liés à un hôtel sont migrés vers la table N:N
INSERT IGNORE INTO hotel_events (hotel_id, event_id)
SELECT hotel_id, id FROM events WHERE hotel_id IS NOT NULL;

-- ── 3. Renommer hotel_id → owner_hotel_id ────────────────────────
-- Conserve la notion de "propriétaire" sans forcer un seul hôtel de diffusion
ALTER TABLE events
    CHANGE COLUMN hotel_id owner_hotel_id INT NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Vérification ─────────────────────────────────────────────────
SELECT 'hotel_events créée' AS info, COUNT(*) AS lignes FROM hotel_events;
SELECT 'events.owner_hotel_id' AS info,
       COUNT(*) AS avec_proprietaire FROM events WHERE owner_hotel_id IS NOT NULL;
