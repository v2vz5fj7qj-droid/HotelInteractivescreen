-- ════════════════════════════════════════════════════════════════
--  Migration 003 — Gestion des catégories par hôtel
--  Ajoute hotel_id aux tables poi_categories, event_categories,
--  info_categories pour permettre des catégories propres à un hôtel.
--  NULL = catégorie globale partagée par tous les hôtels.
--  À exécuter UNE SEULE FOIS.
-- ════════════════════════════════════════════════════════════════

-- 1. poi_categories — hotel_id + created_by
ALTER TABLE poi_categories
  ADD COLUMN IF NOT EXISTS hotel_id   INT  NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT  NULL DEFAULT NULL;

-- Supprime l'ancien index simple s'il existe encore (bases initialisées avant init.sql v2)
ALTER TABLE poi_categories DROP INDEX IF EXISTS key_name;
-- Supprime la clé composite si elle existe déjà (bases fraîches initialisées avec init.sql v2)
ALTER TABLE poi_categories DROP INDEX IF EXISTS uq_poi_cat_key_hotel;
ALTER TABLE poi_categories
  ADD UNIQUE KEY uq_poi_cat_key_hotel (key_name, hotel_id);

-- 2. event_categories — hotel_id + created_by
ALTER TABLE event_categories
  ADD COLUMN IF NOT EXISTS hotel_id   INT  NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT  NULL DEFAULT NULL;

ALTER TABLE event_categories DROP INDEX IF EXISTS key_name;
ALTER TABLE event_categories DROP INDEX IF EXISTS uq_event_cat_key_hotel;
ALTER TABLE event_categories
  ADD UNIQUE KEY uq_event_cat_key_hotel (key_name, hotel_id);

-- 3. info_categories — hotel_id + created_by
ALTER TABLE info_categories
  ADD COLUMN IF NOT EXISTS hotel_id   INT  NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT  NULL DEFAULT NULL;

ALTER TABLE info_categories DROP INDEX IF EXISTS key_name;
ALTER TABLE info_categories DROP INDEX IF EXISTS uq_info_cat_key_hotel;
ALTER TABLE info_categories
  ADD UNIQUE KEY uq_info_cat_key_hotel (key_name, hotel_id);
