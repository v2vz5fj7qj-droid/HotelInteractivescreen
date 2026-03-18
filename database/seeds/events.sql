-- Seeds : Événements locaux — Ouagadougou
CREATE TABLE IF NOT EXISTS events (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    slug         VARCHAR(120) NOT NULL UNIQUE,
    category     ENUM('culture','music','sport','gastronomy','festival','exhibition','hotel') NOT NULL,
    start_date   DATE         NOT NULL,
    end_date     DATE,
    start_time   TIME,
    end_time     TIME,
    location     VARCHAR(200),
    lat          DECIMAL(10,7),
    lng          DECIMAL(10,7),
    price_fcfa   INT DEFAULT 0,          -- 0 = gratuit
    image_url    VARCHAR(255),
    is_featured  BOOLEAN DEFAULT FALSE,
    is_active    BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_start_date (start_date),
    INDEX idx_category   (category)
);

CREATE TABLE IF NOT EXISTS event_translations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    event_id    INT        NOT NULL,
    locale      VARCHAR(5) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    tags        VARCHAR(255),            -- ex: "jazz,concert,gratuit"
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY uq_event_locale (event_id, locale)
);

-- Données initiales (dates relatives à 2026)
INSERT INTO events (slug, category, start_date, end_date, start_time, end_time, location, lat, lng, price_fcfa, is_featured, display_order) VALUES
('fespaco-2026',        'culture',     '2026-02-21', '2026-03-01', '09:00:00', '22:00:00', 'CENASA — Ouagadougou',          12.3650, -1.5290, 0,     TRUE,  1),
('jazz-calebasse',      'music',       '2026-03-20', '2026-03-22', '19:00:00', '23:00:00', 'Jardin de Zaka',                12.3680, -1.5180, 5000,  TRUE,  2),
('salon-artisanat',     'exhibition',  '2026-04-05', '2026-04-12', '08:00:00', '18:00:00', 'Parc des Sports — Ouaga 2000',  12.3490, -1.5050, 1000,  FALSE, 3),
('nuit-gastronomie',    'gastronomy',  '2026-03-28', NULL,         '18:30:00', '23:30:00', 'Hôtel ConnectBé',               12.3641, -1.5332, 15000, TRUE,  4),
('marathon-ouaga',      'sport',       '2026-04-19', NULL,         '06:00:00', '14:00:00', 'Place de la Nation',            12.3600, -1.5360, 2000,  FALSE, 5),
('festival-masques',    'festival',    '2026-05-03', '2026-05-05', '10:00:00', '21:00:00', 'Dédougou (excursion)',           12.4600, -3.4600, 3000,  TRUE,  6),
('expo-photo-burkina',  'exhibition',  '2026-03-25', '2026-04-10', '09:00:00', '17:00:00', 'Institut Français — Ouaga',     12.3720, -1.5310, 0,     FALSE, 7),
('soiree-hotel-live',   'hotel',       '2026-03-22', NULL,         '20:00:00', '23:00:00', 'Bar Rooftop — ConnectBé',       12.3641, -1.5332, 0,     FALSE, 8);

INSERT INTO event_translations (event_id, locale, title, description, tags) VALUES
(1,'fr','FESPACO — Festival Panafricain du Cinéma','Le plus grand festival de cinéma africain au monde. Films, débats, cérémonies dans toute la ville.','cinéma,culture,panafricain,gratuit'),
(1,'en','FESPACO — Pan-African Film Festival','The world''s largest African film festival. Films, debates and ceremonies across the city.','cinema,culture,pan-african,free'),
(2,'fr','Jazz à la Calebasse','Trois nuits de jazz et musiques du monde dans le cadre enchanteur du Jardin de Zaka.','jazz,musique,concert,monde'),
(2,'en','Jazz at La Calebasse','Three nights of jazz and world music in the enchanting Jardin de Zaka setting.','jazz,music,concert,world'),
(3,'fr','Salon International de l\'Artisanat','Exposition-vente des meilleurs artisans du Burkina et d\'Afrique de l\'Ouest.','artisanat,shopping,exposition,afrique'),
(3,'en','International Craft Fair','Exhibition and sale by the finest craftsmen from Burkina and West Africa.','crafts,shopping,exhibition,africa'),
(4,'fr','Nuit Gastronomique ConnectBé','Soirée dégustation exclusive : cuisine burkinabé revisitée par notre Chef. Sur réservation.','gastronomie,hôtel,dîner,exclusif'),
(4,'en','ConnectBé Gourmet Evening','Exclusive tasting evening: Burkinabe cuisine revisited by our Chef. By reservation.','gastronomy,hotel,dinner,exclusive'),
(5,'fr','Marathon International de Ouagadougou','Course populaire ouverte à tous. Distances : 5 km, 10 km, semi et marathon.','sport,running,marathon,ouvertatous'),
(5,'en','Ouagadougou International Marathon','Open race for all. Distances: 5km, 10km, half and full marathon.','sport,running,marathon,opentoall'),
(6,'fr','Festival des Masques et des Arts de Dédougou','Célébration des traditions culturelles du Burkina avec masques, danses et musiques.','festival,masques,culture,tradition'),
(6,'en','Dédougou Masks and Arts Festival','Celebration of Burkina''s cultural traditions with masks, dances and music.','festival,masks,culture,tradition'),
(7,'fr','Exposition Photo — Regards sur le Burkina','50 photographes africains posent leur regard sur le quotidien burkinabé. Entrée libre.','photo,exposition,art,gratuit'),
(7,'en','Photo Exhibition — Views on Burkina','50 African photographers document everyday Burkinabe life. Free entry.','photo,exhibition,art,free'),
(8,'fr','Soirée Live au Rooftop','Concert acoustique en plein air sur la terrasse de l\'hôtel. Entrée libre pour les résidents.','musique,hôtel,rooftop,live'),
(8,'en','Live Rooftop Evening','Open-air acoustic concert on the hotel terrace. Free entry for hotel guests.','music,hotel,rooftop,live');
