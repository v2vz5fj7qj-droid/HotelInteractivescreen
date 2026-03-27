SET NAMES utf8mb4;
-- Seeds : Services Bien-Être ConnectBé
INSERT INTO wellness_services
    (slug, duration_min, price_fcfa, contact_phone, booking_info, available_hours, available_days, display_order)
VALUES
('swedish-massage',  60, 50000, '+22625000201', 'Appelez le poste 201 ou présentez-vous à la réception spa.', '08:00-20:00', 'Lun-Dim', 1),
('facial-care',      45, 30000, '+22625000201', 'Réservation à la réception spa ou par téléphone.', '09:00-19:00', 'Lun-Sam', 2),
('body-scrub',       30, 25000, '+22625000201', 'Sur rendez-vous uniquement. Minimum 2h à l\'avance.', '09:00-18:00', 'Lun-Sam', 3),
('aromatherapy',     60, 45000, '+22625000201', 'Séance à réserver la veille de préférence.', '08:00-20:00', 'Lun-Dim', 4),
('hot-stone',        75, 60000, '+22625000201', 'Réservation obligatoire 24h à l\'avance.', '10:00-18:00', 'Mar-Dim', 5),
('couple-massage',   90, 90000, '+22625000201', 'Réservation pour deux personnes — prévoir 24h à l\'avance.', '10:00-18:00', 'Lun-Dim', 6);

INSERT INTO wellness_service_translations (service_id, locale, name, description, benefits) VALUES
(1,'fr','Massage Suédois',    'Massage relaxant aux huiles essentielles pour libérer les tensions musculaires profondément.', 'Libération des tensions;Amélioration circulation;Détente profonde'),
(1,'en','Swedish Massage',    'Relaxing essential oil massage to deeply release muscle tension.',                             'Tension relief;Improved circulation;Deep relaxation'),
(2,'fr','Soin Visage',        'Soin hydratant et régénérant sur mesure, adapté à votre type de peau.',                      'Hydratation intense;Éclat immédiat;Anti-âge'),
(2,'en','Facial Care',        'Custom moisturizing and regenerating treatment adapted to your skin type.',                   'Deep hydration;Instant glow;Anti-aging'),
(3,'fr','Gommage Corps',      'Exfoliation douce pour éliminer les cellules mortes et révéler une peau soyeuse.',           'Peau veloutée;Éclat naturel;Préparation bronzage'),
(3,'en','Body Scrub',         'Gentle exfoliation to eliminate dead cells and reveal silky skin.',                           'Velvety skin;Natural glow;Tan preparation'),
(4,'fr','Aromathérapie',      'Voyage sensoriel par les huiles essentielles biologiques pour une relaxation totale.',       'Stress réduit;Sommeil amélioré;Équilibre émotionnel'),
(4,'en','Aromatherapy',       'Sensory journey through organic essential oils for total relaxation.',                        'Reduced stress;Improved sleep;Emotional balance'),
(5,'fr','Massage Pierres Chaudes','Les pierres volcaniques chaudes pénètrent les muscles pour un soin unique et profond.',  'Chaleur thérapeutique;Douleurs soulagées;Bien-être total'),
(5,'en','Hot Stone Massage',  'Volcanic hot stones penetrate muscles for a unique and deep treatment.',                      'Therapeutic heat;Pain relief;Total well-being'),
(6,'fr','Massage Duo',        'Partagez un moment de bien-être unique côte à côte dans notre salle couples.',               'Moment partagé;Cabine privée;Huiles au choix'),
(6,'en','Couple Massage',     'Share a unique wellness moment side by side in our couple suite.',                            'Shared moment;Private suite;Choice of oils');
