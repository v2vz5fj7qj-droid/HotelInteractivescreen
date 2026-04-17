-- Migration 004 : ajout d'une colonne JSON pour les traductions supplémentaires des tips
-- Les colonnes titre_fr, titre_en, contenu_fr, contenu_en sont conservées pour la rétrocompatibilité.
-- Les langues supplémentaires (de, es, pt, ar, zh, ja, ru) sont stockées dans translations_json.
-- Format : { "de": { "titre": "...", "contenu": "..." }, "es": { ... }, ... }

ALTER TABLE hotel_tips
  ADD COLUMN IF NOT EXISTS translations_json TEXT NULL DEFAULT NULL
    COMMENT 'JSON des traductions supplémentaires hors FR/EN : { "de": { "titre":"...", "contenu":"..." }, ... }';
