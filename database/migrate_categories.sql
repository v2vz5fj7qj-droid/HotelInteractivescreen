-- ════════════════════════════════════════════════════════
--  Migration : gestion dynamique des catégories POI & Infos
--  À exécuter UNE SEULE FOIS sur une base existante.
-- ════════════════════════════════════════════════════════

-- 1. Modifier les colonnes ENUM en VARCHAR (compatible avec les données existantes)
ALTER TABLE points_of_interest
  MODIFY COLUMN category VARCHAR(50) NOT NULL;

ALTER TABLE useful_contacts
  MODIFY COLUMN category VARCHAR(50) NOT NULL;

-- 2. Créer la table des catégories POI
CREATE TABLE IF NOT EXISTS poi_categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    key_name     VARCHAR(50)  NOT NULL UNIQUE,
    label_fr     VARCHAR(100) NOT NULL,
    label_en     VARCHAR(100) NOT NULL,
    icon         VARCHAR(10)  NOT NULL DEFAULT '📍',
    color        VARCHAR(7)   NOT NULL DEFAULT '#C2782A',
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insérer les catégories POI par défaut (IGNORE si déjà présentes)
INSERT IGNORE INTO poi_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('restaurant', 'Restaurants', 'Restaurants', '🍽️', '#E8521A', 1),
('museum',     'Musées',      'Museums',     '🏛️', '#D4A843', 2),
('attraction', 'Attractions', 'Attractions', '🎯', '#8B4F12', 3),
('pharmacy',   'Pharmacies',  'Pharmacies',  '💊', '#27ae60', 4),
('hospital',   'Hôpitaux',    'Hospitals',   '🏥', '#e74c3c', 5),
('taxi',       'Taxis',       'Taxis',       '🚖', '#f39c12', 6),
('market',     'Marchés',     'Markets',     '🛍️', '#9b59b6', 7);

-- 4. Créer la table des catégories Infos utiles
CREATE TABLE IF NOT EXISTS info_categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    key_name     VARCHAR(50)  NOT NULL UNIQUE,
    label_fr     VARCHAR(100) NOT NULL,
    label_en     VARCHAR(100) NOT NULL,
    icon         VARCHAR(10)  NOT NULL DEFAULT '📋',
    color        VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Modifier la colonne ENUM events en VARCHAR
ALTER TABLE events
  MODIFY COLUMN category VARCHAR(50) NOT NULL;

-- 7. Créer la table des catégories événements
CREATE TABLE IF NOT EXISTS event_categories (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    key_name     VARCHAR(50)  NOT NULL UNIQUE,
    label_fr     VARCHAR(100) NOT NULL,
    label_en     VARCHAR(100) NOT NULL,
    icon         VARCHAR(10)  NOT NULL DEFAULT '🗓️',
    color        VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
    display_order INT DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Insérer les catégories événements par défaut
INSERT IGNORE INTO event_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('culture',     'Culture',     'Culture',     '🎭', '#8B5CF6', 1),
('music',       'Musique',     'Music',       '🎵', '#EC4899', 2),
('sport',       'Sport',       'Sport',       '🏃', '#10B981', 3),
('gastronomy',  'Gastronomie', 'Gastronomy',  '🍽️', '#F59E0B', 4),
('festival',    'Festival',    'Festival',    '🎉', '#EF4444', 5),
('exhibition',  'Exposition',  'Exhibition',  '🖼️', '#3B82F6', 6),
('hotel',       'Hôtel',       'Hotel',       '🏨', '#C2782A', 7);

-- 5. Insérer les catégories Infos par défaut (IGNORE si déjà présentes)
INSERT IGNORE INTO info_categories (key_name, label_fr, label_en, icon, color, display_order) VALUES
('taxi',      'Taxi',       'Taxi',       '🚕', '#F59E0B', 1),
('doctor',    'Médecin',    'Doctor',     '👨‍⚕️', '#3B82F6', 2),
('pharmacy',  'Pharmacie',  'Pharmacy',   '💊', '#10B981', 3),
('shuttle',   'Navette',    'Shuttle',    '🚌', '#8B5CF6', 4),
('emergency', 'Urgences',   'Emergency',  '🚨', '#EF4444', 5),
('embassy',   'Ambassade',  'Embassy',    '🏛️', '#6366F1', 6),
('bank',      'Banque',     'Bank',       '🏦', '#0EA5E9', 7);
