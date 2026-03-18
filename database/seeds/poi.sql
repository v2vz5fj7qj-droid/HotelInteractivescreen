-- Seeds : Points d'intérêt — Ouagadougou
INSERT INTO points_of_interest (category, lat, lng, phone, rating, price_level, display_order) VALUES
-- Restaurants
('restaurant', 12.3700, -1.5280, '+22625310000', 4.3, 2, 1),
('restaurant', 12.3620, -1.5350, '+22625320000', 4.1, 1, 2),
('restaurant', 12.3680, -1.5180, '+22625330000', 4.5, 3, 3),
-- Musées / Attractions
('museum',     12.3550, -1.5300, '+22625440000', 4.6, 1, 1),
('attraction', 12.3490, -1.5420, null,            4.4, 1, 2),
-- Pharmacies
('pharmacy',   12.3645, -1.5340, '+22625550000', null, 1, 1),
('pharmacy',   12.3600, -1.5290, '+22625560000', null, 1, 2),
-- Taxis
('taxi',       12.3641, -1.5332, '+22670100000', 4.2, 1, 1),
-- Hôpitaux
('hospital',   12.3530, -1.5450, '+22625770000', 4.0, 1, 1),
-- Marché
('market',     12.3610, -1.5390, null,            4.3, 1, 1);

INSERT INTO poi_translations (poi_id, locale, name, address, description) VALUES
(1,'fr','Restaurant Le Wend Kossam','Avenue Kwame Nkrumah, Ouagadougou','Cuisine burkinabé authentique et grillades. Vue sur le jardin.'),
(1,'en','Le Wend Kossam Restaurant','Avenue Kwame Nkrumah, Ouagadougou','Authentic Burkinabe cuisine and grills. Garden view.'),
(2,'fr','Maquis du Quartier','Rue 4.22, Secteur 4','Plats locaux et attiéké. Ambiance conviviale.'),
(2,'en','Maquis du Quartier','Rue 4.22, Secteur 4','Local dishes and attiéké. Friendly atmosphere.'),
(3,'fr','Le Jardin de Zaka','Boulevard Charles de Gaulle','Restaurant gastronomique franco-africain. Terrasse climatisée.'),
(3,'en','Le Jardin de Zaka','Boulevard Charles de Gaulle','Franco-African gourmet restaurant. Air-conditioned terrace.'),
(4,'fr','Musée National du Burkina Faso','Avenue de l\'Indépendance','Collections d\'art traditionnel, masques et costumes des ethnies du Burkina.'),
(4,'en','National Museum of Burkina Faso','Avenue de l\'Indépendance','Traditional art collections, masks and ethnic costumes of Burkina Faso.'),
(5,'fr','Monument des Martyrs','Place de la Nation','Monument emblématique dédié aux héros de la nation. Vue panoramique.'),
(5,'en','Martyrs Monument','Place de la Nation','Iconic monument dedicated to national heroes. Panoramic view.'),
(6,'fr','Pharmacie de la Paix','Rue de la Paix, non loin de l\'hôtel','Pharmacie ouverte de 7h à 22h. Garde de nuit sur appel.'),
(6,'en','Pharmacie de la Paix','Rue de la Paix, near the hotel','Pharmacy open 7am-10pm. Night duty on call.'),
(7,'fr','Pharmacie Centrale','Avenue Yennenga','Grande pharmacie avec stock complet. Ouverte jusqu\'à 21h.'),
(7,'en','Pharmacie Centrale','Avenue Yennenga','Large pharmacy with full stock. Open until 9pm.'),
(8,'fr','Taxis ConnectBé','Service hôtel','Taxis partenaires de l\'hôtel. Tarifs négociés. Disponibles 24h/24.'),
(8,'en','ConnectBé Taxis','Hotel service','Hotel partner taxis. Negotiated rates. Available 24/7.'),
(9,'fr','Clinique Bon Samaritain','Boulevard de la Révolution','Clinique privée. Urgences 24h/24. Médecins francophones.'),
(9,'en','Clinique Bon Samaritain','Boulevard de la Révolution','Private clinic. Emergency 24/7. French-speaking doctors.'),
(10,'fr','Marché de Rood Woko','Centre-ville','Le plus grand marché de Ouagadougou. Artisanat, tissus, épices.'),
(10,'en','Rood Woko Market','City center','The largest market in Ouagadougou. Crafts, fabrics, spices.');
