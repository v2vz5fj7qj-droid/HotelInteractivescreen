-- ════════════════════════════════════════════════════════════════
--  ConnectBé — Migration 016 : sections activables par hôtel
--
--  hotel_settings.enabled_sections : tableau JSON des clés de sections
--  visibles sur le kiosque (voir backend/src/data/sections.json).
--  NULL = toutes les sections actives (comportement des hôtels existants).
--
--  Idempotent : ne fait rien si la colonne est déjà présente.
-- ════════════════════════════════════════════════════════════════

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE table_schema = DATABASE()
              AND table_name   = 'hotel_settings'
              AND column_name  = 'enabled_sections');
SET @s1 := IF(@c1 = 0,
  'ALTER TABLE hotel_settings ADD COLUMN enabled_sections JSON NULL DEFAULT NULL COMMENT ''Clés des sections kiosque activées ; NULL = toutes''',
  'DO 0');
PREPARE st1 FROM @s1; EXECUTE st1; DEALLOCATE PREPARE st1;
