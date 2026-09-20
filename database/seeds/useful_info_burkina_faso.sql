SET NAMES utf8mb4;

-- ════════════════════════════════════════════════════════════════
--  Infos utiles — ConnectBé Ouagadougou (hotel_id = 1), Burkina Faso
--  Urgences, ambassades, santé, banque, transport.
--  Catégories utilisées (globales, voir info_categories) :
--    emergency, embassy, doctor, pharmacy, bank, taxi, shuttle
--
--  Sources vérifiées (09/2026) : Police Nationale du Burkina Faso,
--  Gendarmerie nationale du Burkina Faso, Wakat Séra (numéros
--  pompiers), afrique-sur7.fr (lancement SAMU Ouagadougou),
--  ambamali-bf.org (Mali), ouagadougou.mfa.gov.gh (Ghana), annuaires
--  diplomatiques (Niger), CHUYO, Clinique El Fateh-Suka (suka.bf),
--  SOTRACO, banquepostale.bf (Banque Postale du Burkina Faso).
--  ⚠️ Le taxi "Allo Taxi" provient d'annuaires locaux non officiels :
--  à faire confirmer par l'hôtel avant diffusion définitive.
--  ⚠️ Le Consulat Général du Niger n'a pas de numéro de téléphone
--  fiable trouvé publiquement — seule une adresse/email officiels
--  sont disponibles ; à faire vérifier/compléter par l'hôtel.
-- ════════════════════════════════════════════════════════════════

-- ── Urgences (numéros nationaux, valables sur tout le Burkina Faso) ──

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('emergency', '17', NULL, 'https://www.police.gov.bf/index.php/a-votre-service/police-secours', 1, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Police Secours', 'Numéro d''urgence national de la Police Nationale, disponible 24h/24 pour tout danger immédiat.', 'Ouagadougou'),
(@c, 'en', 'Police Emergency', 'National emergency number of the Burkina Faso Police, available 24/7 for any immediate danger.', 'Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('emergency', '16', NULL, 'https://gendarmerienationale.bf/contacts/', 1, 2, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Gendarmerie Nationale', 'Numéro d''urgence de la Gendarmerie nationale du Burkina Faso, disponible 24h/24.', 'Ouagadougou'),
(@c, 'en', 'National Gendarmerie', 'Emergency number of the Burkina Faso National Gendarmerie, available 24/7.', 'Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('emergency', '18', NULL, NULL, 1, 3, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Sapeurs-Pompiers', 'Numéro d''urgence national des sapeurs-pompiers : incendie, accident, secours à personne. Disponible 24h/24.', 'Ouagadougou'),
(@c, 'en', 'Fire Brigade', 'National fire brigade emergency number: fire, accident, rescue. Available 24/7.', 'Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('emergency', '15', NULL, NULL, 1, 4, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'SAMU Ouagadougou', 'Service d''Aide Médicale Urgente : appel gratuit pour toute urgence médicale nécessitant l''envoi d''une équipe médicalisée. Disponible 24h/24.', 'Ouagadougou'),
(@c, 'en', 'SAMU Ouagadougou (Emergency Medical Service)', 'Toll-free emergency medical service dispatching a doctor and equipped ambulance. Available 24/7.', 'Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

-- ── Ambassades ────────────────────────────────────────────────────

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('embassy', NULL, NULL, NULL, 0, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Consulat Général du Niger', 'Représentation diplomatique du Niger au Burkina Faso — visas et assistance consulaire. Ouvert du lundi au vendredi sur rendez-vous. Email : saasayadi@gmail.fr', 'Arrondissement 12, Secteur 54, Avenue Charles Bila Kaboré, 11 BP 1015 CMS Ouaga 11, Ouagadougou'),
(@c, 'en', 'Consulate General of Niger', 'Niger''s diplomatic representation in Burkina Faso — visas and consular assistance. Open Monday to Friday by appointment. Email: saasayadi@gmail.fr', 'Arrondissement 12, Secteur 54, Avenue Charles Bila Kaboré, 11 BP 1015 CMS Ouaga 11, Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('embassy', '+22625374608', NULL, 'https://ambamali-bf.org/', 0, 2, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Ambassade du Mali', 'Standard de l''ambassade — visas et assistance consulaire pour les ressortissants maliens. Ouvert lundi-jeudi 8h30-15h30, vendredi 8h30-12h30 et 14h-16h.', 'Avenue Pascal Zagré, Ouaga 2000, 01 BP 1911, Ouagadougou'),
(@c, 'en', 'Embassy of Mali', 'Embassy switchboard — visas and consular assistance for Malian nationals. Open Monday-Thursday 8:30 AM-3:30 PM, Friday 8:30 AM-12:30 PM and 2-4 PM.', 'Avenue Pascal Zagré, Ouaga 2000, 01 BP 1911, Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('embassy', '+22625307635', NULL, 'https://ouagadougou.mfa.gov.gh/', 0, 3, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Ambassade du Ghana', 'Standard de l''ambassade — visas et assistance consulaire pour les ressortissants ghanéens. Ouvert du lundi au vendredi, 9h-14h.', 'Avenue du Capitaine Thomas Sankara, Paspanga, Ouagadougou'),
(@c, 'en', 'Embassy of Ghana', 'Embassy switchboard — visas and consular assistance for Ghanaian nationals. Open Monday to Friday, 9:00 AM-2:00 PM.', 'Avenue du Capitaine Thomas Sankara, Paspanga, Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

-- ── Santé ─────────────────────────────────────────────────────────

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('doctor', '+22625311655', NULL, 'http://chuyobf.org/', 1, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'CHU Yalgado Ouédraogo', 'Principal centre hospitalier universitaire public de Ouagadougou, service d''urgences ouvert 24h/24.', '03 BP 7022, Ouagadougou 03'),
(@c, 'en', 'Yalgado Ouédraogo University Hospital', 'Main public university hospital in Ouagadougou, with a 24/7 emergency department.', '03 BP 7022, Ouagadougou 03');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('doctor', '+22625430600', NULL, 'https://suka-bf.com/', 1, 2, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Clinique El Fateh-Suka', 'Clinique privée de spécialités médico-chirurgicales : médecine générale, gynéco-obstétrique, chirurgie, radiologie, laboratoire.', '04 BP 8297, Ouagadougou 04'),
(@c, 'en', 'El Fateh-Suka Clinic', 'Private medical-surgical clinic: general medicine, obstetrics-gynecology, surgery, radiology, laboratory.', '04 BP 8297, Ouagadougou 04');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

-- ── Pharmacie ─────────────────────────────────────────────────────

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('pharmacy', NULL, NULL, 'https://ordrepharmacien.bf/index.php/pharmacie-de-garde-ouagadougou/', 1, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Pharmacies de garde — Ouagadougou', 'Les pharmacies de la ville sont réparties en groupes qui assurent la garde à tour de rôle (nuits, dimanches, jours fériés). Consultez la liste actualisée sur le site de l''Ordre National des Pharmaciens du Burkina Faso, ou demandez à la réception.', 'Ouagadougou'),
(@c, 'en', 'On-Duty Pharmacies — Ouagadougou', 'City pharmacies are divided into rotating groups covering nights, Sundays and public holidays. Check the current schedule on the Burkina Faso National Order of Pharmacists website, or ask at reception.', 'Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

-- ── Banque ────────────────────────────────────────────────────────

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('bank', '+22625328100', NULL, 'https://www.banquepostale.bf/presentation', 0, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Banque Postale du Burkina Faso', 'Siège de la Banque Postale du Burkina Faso (BPBF) : ouverture de compte, retrait, change. Une seconde agence existe à Ouaga 2000, boulevard de l''Insurrection populaire.', 'Avenue du Président Sangoulé Lamizana, Arrondissement 01, Secteur 03, 01 BP 1366, Ouagadougou'),
(@c, 'en', 'Postal Bank of Burkina Faso', 'Head office of the Postal Bank of Burkina Faso (BPBF): account opening, cash withdrawal, currency exchange. A second branch is located in Ouaga 2000, Boulevard de l''Insurrection Populaire.', 'Avenue du Président Sangoulé Lamizana, Arrondissement 01, Secteur 03, 01 BP 1366, Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

-- ── Taxi ──────────────────────────────────────────────────────────

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('taxi', '+22650343435', '+22666669999', NULL, 1, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'Allo Taxi', 'Réservation de taxi par téléphone, jour et nuit, pour vos déplacements en ville.', 'Ouagadougou'),
(@c, 'en', 'Allo Taxi', 'Phone taxi booking, day and night, for getting around the city.', 'Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);

-- ── Navette / transport en commun ────────────────────────────────

INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order, is_active, owner_hotel_id, created_by, status, validated_by, validated_at)
VALUES ('shuttle', '+22625355555', NULL, 'https://sotraco.bf/', 0, 1, 1, 1, 1, 'published', 1, NOW());
SET @c = LAST_INSERT_ID();
INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES
(@c, 'fr', 'SOTRACO — Bus urbain', 'Réseau de bus public de Ouagadougou, plusieurs lignes couvrant la ville. Service de 7h30 à 18h00.', '2257 Avenue du Sanmatenga, Secteur 19, Ouagadougou'),
(@c, 'en', 'SOTRACO — City Bus', 'Ouagadougou''s public bus network, several lines covering the city. Runs 7:30 AM to 6:00 PM.', '2257 Avenue du Sanmatenga, Secteur 19, Ouagadougou');
INSERT INTO hotel_info (hotel_id, info_id) VALUES (1, @c);
