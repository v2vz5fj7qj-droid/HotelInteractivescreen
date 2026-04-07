-- Migration : ajout des colonnes multilingues sur la table notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS message_de VARCHAR(500) AFTER message_en,
  ADD COLUMN IF NOT EXISTS message_es VARCHAR(500) AFTER message_de,
  ADD COLUMN IF NOT EXISTS message_pt VARCHAR(500) AFTER message_es,
  ADD COLUMN IF NOT EXISTS message_ar VARCHAR(500) AFTER message_pt,
  ADD COLUMN IF NOT EXISTS message_zh VARCHAR(500) AFTER message_ar,
  ADD COLUMN IF NOT EXISTS message_ja VARCHAR(500) AFTER message_zh,
  ADD COLUMN IF NOT EXISTS message_ru VARCHAR(500) AFTER message_ja;
