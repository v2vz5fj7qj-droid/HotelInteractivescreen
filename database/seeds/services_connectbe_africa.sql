SET NAMES utf8mb4;

-- ════════════════════════════════════════════════════════════════
--  ConnectBé (hotel_id = 1) — Catégories & services à l'africaine
-- ════════════════════════════════════════════════════════════════

-- ── Nouvelles catégories propres à l'hôtel ──────────────────────
INSERT INTO service_categories (hotel_id, label_fr, label_en, icon, display_order, created_by)
VALUES (1, 'Culture & Artisanat', 'Culture & Craft', '🎭', 1, 1);
SET @cat_culture = LAST_INSERT_ID();

INSERT INTO service_categories (hotel_id, label_fr, label_en, icon, display_order, created_by)
VALUES (1, 'Excursions & Découverte', 'Excursions & Discovery', '🧭', 2, 1);
SET @cat_excursions = LAST_INSERT_ID();

INSERT INTO service_categories (hotel_id, label_fr, label_en, icon, display_order, created_by)
VALUES (1, 'Saveurs du Burkina', 'Flavors of Burkina', '🍲', 3, 1);
SET @cat_saveurs = LAST_INSERT_ID();

-- ── Spa & Bien-être (catégorie globale id 1) ────────────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 1, 'rituel-karite', 50, 40000, '+22625000201', 'Sur rendez-vous à la réception spa.', '09:00-19:00', 'Lun-Sam', 10, 7);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Rituel Beurre de Karité', 'Soin corporel signature à base de beurre de karité pur, issu des coopératives féminines locales, pour une peau nourrie et un moment de détente ancré dans les traditions burkinabè.', 'Hydratation profonde ; Peau adoucie ; Soutien à l''artisanat local'),
(@s, 'en', 'Shea Butter Ritual', 'Signature body treatment with pure shea butter sourced from local women''s cooperatives, nourishing the skin in a ritual rooted in Burkinabè tradition.', 'Deep hydration ; Softened skin ; Supports local craftsmanship');

-- ── Restauration (catégorie globale id 2) ───────────────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 2, 'petit-dejeuner-sahelien', NULL, 8000, '+22625000301', 'Inclus pour les clients hébergés ; accès possible pour les visiteurs sur réservation.', '06:30-10:30', 'Lun-Dim', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Petit-Déjeuner Sahélien', 'Buffet matinal mêlant classiques continentaux et spécialités locales : bouillie de mil, beignets, jus de bissap et de gingembre, fruits de saison.', 'Produits locaux ; Options végétariennes ; Fait maison'),
(@s, 'en', 'Sahelian Breakfast', 'Morning buffet blending continental classics with local specialties: millet porridge, beignets, hibiscus and ginger juice, seasonal fruit.', 'Local produce ; Vegetarian options ; Homemade');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 2, 'diner-terrasse-fusion', NULL, 15000, '+22625000301', 'Réservation recommandée, notamment le week-end.', '19:00-22:30', 'Lun-Dim', 10, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Dîner Terrasse Fusion Afro-Internationale', 'Cuisine de saison entre saveurs burkinabè revisitées et influences internationales, servie sur la terrasse du restaurant.', 'Cadre en plein air ; Carte évolutive ; Chef local'),
(@s, 'en', 'Afro-International Fusion Terrace Dinner', 'Seasonal cuisine pairing reinvented Burkinabè flavors with international influences, served on the restaurant terrace.', 'Open-air setting ; Rotating menu ; Local chef');

-- ── Sport & Piscine (catégorie globale id 3) ────────────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 3, 'acces-piscine-journee', NULL, 5000, '+22625001234', 'Accès libre pour les clients de l''hôtel ; pass journée pour les visiteurs extérieurs.', '07:00-19:00', 'Lun-Dim', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Accès Piscine à Débordement', 'Profitez de la piscine à débordement de l''hôtel, transats et service bar au bord de l''eau.', 'Vue dégagée ; Service au bord de l''eau ; Serviettes fournies'),
(@s, 'en', 'Infinity Pool Day Access', 'Enjoy the hotel''s infinity pool with sun loungers and poolside bar service.', 'Open views ; Poolside service ; Towels provided');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 3, 'yoga-lever-soleil', 60, 10000, '+22625001234', 'Réservation la veille avant 18h, tapis fournis.', '06:00-07:00', 'Mar, Jeu, Sam', 10, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Yoga au Lever du Soleil', 'Séance de yoga en plein air face au jardin, animée par un professeur local, pour démarrer la journée en pleine sérénité.', 'Cadre naturel ; Tous niveaux ; Professeur local'),
(@s, 'en', 'Sunrise Yoga', 'Outdoor yoga session facing the garden, led by a local instructor, to start the day in full serenity.', 'Natural setting ; All levels ; Local instructor');

-- ── Transport (catégorie globale id 4) ──────────────────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 4, 'transfert-aeroport-oua', 30, 15000, '+22625001234', 'À réserver au moins 24h avant l''arrivée, avec numéro de vol.', '24h/24', 'Lun-Dim', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Transfert Aéroport Ouagadougou (OUA)', 'Navette privée entre l''aéroport international de Ouagadougou et l''hôtel, chauffeur à votre accueil avec pancarte nominative.', 'Accueil personnalisé ; Suivi de vol ; Véhicule climatisé'),
(@s, 'en', 'Ouagadougou Airport Transfer (OUA)', 'Private shuttle between Ouagadougou International Airport and the hotel, driver waiting with a name board.', 'Personal welcome ; Flight tracking ; Air-conditioned vehicle');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 4, 'chauffeur-prive-journee', 480, 50000, '+22625001234', 'Réservation 24h à l''avance ; carburant et péages inclus.', '08:00-18:00', 'Lun-Dim', 10, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Voiture avec Chauffeur Privé — Journée', 'Location de véhicule climatisé avec chauffeur pour vos déplacements en ville ou vos excursions à la journée.', 'Chauffeur francophone ; Flexibilité de l''itinéraire ; Véhicule climatisé'),
(@s, 'en', 'Private Car with Driver — Full Day', 'Air-conditioned vehicle with driver for city trips or full-day excursions.', 'French-speaking driver ; Flexible itinerary ; Air-conditioned vehicle');

-- ── Loisirs (catégorie globale id 5) ────────────────────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 5, 'soiree-live-afrobeat', NULL, 0, '+22625001234', 'Entrée libre pour les clients de l''hôtel, places limitées au bar.', '20:00-23:00', 'Ven', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Soirée Concert Live — Rythmes d''Afrique', 'Concert live hebdomadaire au bar de l''hôtel avec des musiciens locaux : afrobeat, coupé-décalé et rythmes traditionnels revisités.', 'Musiciens locaux ; Ambiance conviviale ; Bar sur place'),
(@s, 'en', 'Live Concert Night — Rhythms of Africa', 'Weekly live concert at the hotel bar featuring local musicians: afrobeat, coupé-décalé and reimagined traditional rhythms.', 'Local musicians ; Friendly atmosphere ; On-site bar');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 5, 'cinema-plein-air', NULL, 0, '+22625001234', 'Programme disponible à la réception, gratuit pour les résidents.', '19:30-21:30', 'Dim', 10, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Cinéma Plein Air', 'Projection en plein air dans le jardin de l''hôtel, films africains et internationaux, transats et pop-corn.', 'Jardin aménagé ; Sélection de films africains ; Pop-corn offert'),
(@s, 'en', 'Open-Air Cinema', 'Open-air screening in the hotel garden, African and international films, loungers and popcorn.', 'Landscaped garden ; African film selection ; Free popcorn');

-- ── Conciergerie (catégorie globale id 6) ───────────────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 6, 'guide-touristique-personnel', NULL, 25000, '+22625001234', 'Tarif à la journée, réservation 48h à l''avance recommandée.', '08:00-18:00', 'Lun-Dim', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Guide Touristique Personnel', 'Guide francophone/anglophone à disposition pour organiser vos visites de Ouagadougou et de ses environs sur-mesure.', 'Guide certifié ; Circuit sur-mesure ; Bilingue FR/EN'),
(@s, 'en', 'Personal Tour Guide', 'French/English-speaking guide available to arrange tailor-made visits of Ouagadougou and its surroundings.', 'Certified guide ; Tailor-made itinerary ; Bilingual FR/EN');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, 6, 'blanchisserie-express', 240, 3000, '+22625001234', 'Dépôt à la réception avant 12h pour un retour le jour même.', '07:00-20:00', 'Lun-Dim', 10, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Blanchisserie Express', 'Service de blanchisserie et repassage avec retour sous 4 heures pour les demandes urgentes.', 'Retour rapide ; Repassage inclus ; Prix à la pièce'),
(@s, 'en', 'Express Laundry', 'Laundry and pressing service with 4-hour turnaround for urgent requests.', 'Fast turnaround ; Pressing included ; Priced per item');

-- ── Culture & Artisanat (nouvelle catégorie hôtel) ──────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_culture, 'soiree-contes-griot', 60, 0, '+22625001234', 'Gratuit pour les résidents, inscription à la réception.', '19:30-20:30', 'Mer', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Soirée Contes du Griot', 'Un griot traditionnel partage légendes, proverbes et histoires du Burkina Faso au son de la kora, dans le jardin de l''hôtel.', 'Immersion culturelle ; Moment convivial en famille ; Découverte du patrimoine oral'),
(@s, 'en', 'Griot Storytelling Evening', 'A traditional griot shares legends, proverbs and stories of Burkina Faso to the sound of the kora, in the hotel garden.', 'Cultural immersion ; Family-friendly moment ; Discover oral heritage');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_culture, 'atelier-bogolan', 120, 20000, '+22625001234', 'Matériel fourni, réservation la veille, groupes de 6 personnes maximum.', '15:00-17:00', 'Mar-Sam', 6, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Atelier Teinture Bogolan', 'Initiez-vous à l''art traditionnel du bogolan (tissu teint à la boue) avec un artisan local et repartez avec votre création.', 'Artisan local ; Création à emporter ; Technique traditionnelle'),
(@s, 'en', 'Bogolan Dyeing Workshop', 'Learn the traditional art of bogolan (mud-dyed cloth) with a local craftsperson and take home your own creation.', 'Local artisan ; Take-home creation ; Traditional technique');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_culture, 'initiation-djembe', 45, 15000, '+22625001234', 'Instruments fournis, tenue décontractée conseillée.', '17:00-18:00', 'Lun-Ven', 10, 3);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Initiation au Djembé', 'Cours d''initiation au djembé avec un percussionniste professionnel : rythmes traditionnels et jeu collectif.', 'Percussionniste professionnel ; Instruments fournis ; Ouvert aux débutants'),
(@s, 'en', 'Djembe Drumming Introduction', 'Introductory djembe lesson with a professional percussionist: traditional rhythms and group play.', 'Professional percussionist ; Instruments provided ; Beginner friendly');

-- ── Excursions & Découverte (nouvelle catégorie hôtel) ──────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_excursions, 'visite-guidee-ouagadougou', 240, 30000, '+22625001234', 'Réservation 24h à l''avance, transport inclus.', '08:30-12:30', 'Lun-Sam', 10, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Visite Guidée de Ouagadougou', 'Découverte du Grand Marché, de la Cathédrale, du Palais du Moro-Naba et du Village Artisanal avec un guide local francophone.', 'Transport inclus ; Guide local ; Sites emblématiques'),
(@s, 'en', 'Guided Tour of Ouagadougou', 'Discover the Grand Marché, the Cathedral, the Moro-Naba Palace and the Village Artisanal with a local French-speaking guide.', 'Transport included ; Local guide ; Landmark sites');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_excursions, 'excursion-caimans-bazoule', 300, 45000, '+22625001234', 'Réservation 48h à l''avance, transport et guide inclus.', '08:00-13:00', 'Mar, Jeu, Sam', 8, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Excursion aux Caïmans Sacrés de Bazoulé', 'Demi-journée à Bazoulé pour observer de près les caïmans sacrés, dans le respect des traditions locales.', 'Site naturel unique ; Guide et transport inclus ; Expérience culturelle'),
(@s, 'en', 'Sacred Crocodiles of Bazoulé Excursion', 'Half-day trip to Bazoulé to observe the sacred crocodiles up close, in keeping with local traditions.', 'Unique natural site ; Guide and transport included ; Cultural experience');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_excursions, 'tournee-marches-artisanaux', 180, 20000, '+22625001234', 'Réservation la veille, transport inclus.', '09:00-12:00', 'Lun-Ven', 10, 3);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Tournée des Marchés Artisanaux', 'Circuit shopping accompagné dans les marchés et coopératives d''artisanat de Ouagadougou : bronze, tissage, bijoux.', 'Accompagnement personnalisé ; Coopératives locales ; Artisanat authentique'),
(@s, 'en', 'Artisan Markets Tour', 'Guided shopping circuit through Ouagadougou''s craft markets and cooperatives: bronze, weaving, jewelry.', 'Personal guide ; Local cooperatives ; Authentic craftsmanship');

-- ── Saveurs du Burkina (nouvelle catégorie hôtel) ───────────────
INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_saveurs, 'atelier-cuisine-to-sauce-gombo', 90, 18000, '+22625000301', 'Réservation la veille, groupes de 8 personnes maximum.', '16:00-17:30', 'Mar, Jeu', 8, 1);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Atelier Cuisine — Tô & Sauce Gombo', 'Apprenez à préparer le tô et sa sauce gombo aux côtés du chef, puis dégustez votre création.', 'Chef local ; Recette traditionnelle ; Dégustation incluse'),
(@s, 'en', 'Cooking Class — Tô & Okra Sauce', 'Learn to prepare tô and its okra sauce alongside the chef, then taste your own creation.', 'Local chef ; Traditional recipe ; Tasting included');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_saveurs, 'degustation-dolo-bissap', 45, 8000, '+22625000301', 'Réservation à la réception, version non-alcoolisée disponible.', '18:00-19:00', 'Ven-Sam', 10, 2);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Dégustation Dolo & Bissap', 'Découverte commentée des boissons traditionnelles burkinabè : dolo (bière de mil) et bissap (hibiscus), avec accompagnements locaux.', 'Dégustation commentée ; Produits locaux ; Option sans alcool'),
(@s, 'en', 'Dolo & Bissap Tasting', 'Guided tasting of traditional Burkinabè beverages: dolo (millet beer) and bissap (hibiscus), with local accompaniments.', 'Guided tasting ; Local products ; Non-alcoholic option');

INSERT INTO services (hotel_id, category_id, slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, max_per_day, display_order)
VALUES (1, @cat_saveurs, 'diner-sous-les-etoiles', 120, 35000, '+22625000301', 'Réservation 24h à l''avance, idéal pour les occasions spéciales.', '19:30-21:30', 'Lun-Dim', 6, 3);
SET @s = LAST_INSERT_ID();
INSERT INTO service_translations (service_id, locale, name, description, benefits) VALUES
(@s, 'fr', 'Dîner sous les Étoiles', 'Table privée dans le jardin de l''hôtel, menu dégustation de spécialités burkinabè revisitées, service aux chandelles.', 'Table privée ; Menu dégustation ; Service aux chandelles'),
(@s, 'en', 'Dinner Under the Stars', 'Private table in the hotel garden, tasting menu of reinvented Burkinabè specialties, candlelit service.', 'Private table ; Tasting menu ; Candlelit service');
