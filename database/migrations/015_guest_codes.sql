-- 015 — Codes d'accès client (séjour) et sessions visiteurs
--
-- Un code court par séjour/chambre, remis au client à l'enregistrement, qui ouvre
-- l'ensemble du menu front-office depuis son propre téléphone pendant son séjour.
--
-- Deux tables, sur le même motif que kiosk_keys / kiosks :
--   guest_codes    — le code remis au client (réutilisable pendant la fenêtre de séjour)
--   guest_sessions — un appareil rattaché à ce code (plafonné par max_devices)
--
-- Pendant JS idempotent : backend/src/services/runMigrations.js → migration018().
-- Ne pas jouer ce fichier sur une installation neuve (voir README.md du dossier).

CREATE TABLE IF NOT EXISTS guest_codes (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id       INT NOT NULL,
    -- 6 caractères base32 Crockford sans caractères ambigus (ni O/0 ni I/1/L).
    -- VARCHAR(12) laisse la place à un format plus long sans migration.
    code           VARCHAR(12) NOT NULL,
    room_number    VARCHAR(20)  NULL,
    guest_name     VARCHAR(120) NULL,
    occupants      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    -- Plancher applicatif à 2 : un client seul a souvent téléphone + tablette.
    max_devices    TINYINT UNSIGNED NOT NULL DEFAULT 2,
    valid_from     DATETIME NOT NULL,
    valid_until    DATETIME NOT NULL,
    -- Marge de courtoisie après le départ, en heures (24 h par défaut).
    grace_hours    SMALLINT UNSIGNED NOT NULL DEFAULT 24,
    revoked_at     DATETIME NULL,
    -- Horodatage de la purge RGPD : guest_name vidé, sessions supprimées.
    anonymized_at  DATETIME NULL,
    created_by     INT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_guest_code_hotel  (hotel_id, code),
    INDEX idx_guest_codes_hotel     (hotel_id),
    INDEX idx_guest_codes_until     (valid_until),
    CONSTRAINT fk_guest_codes_hotel   FOREIGN KEY (hotel_id)   REFERENCES hotels(id)      ON DELETE CASCADE,
    CONSTRAINT fk_guest_codes_creator FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_sessions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    code_id        INT NOT NULL,
    -- Le jeton n'est jamais stocké en clair : seul son SHA-256 sert de clé de
    -- révocation. Un vol de base ne donne donc pas d'accès aux séjours en cours.
    token_hash     CHAR(64) NOT NULL,
    fingerprint    VARCHAR(64)  NULL,
    user_agent     VARCHAR(255) NULL,
    ip_first       VARCHAR(45)  NULL,
    revoked_at     DATETIME NULL,
    first_seen_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at   DATETIME NULL,
    UNIQUE KEY uq_guest_session_token (token_hash),
    -- Un rechargement de page depuis le même appareil réutilise sa session au
    -- lieu de consommer un second slot du quota.
    UNIQUE KEY uq_guest_session_fp    (code_id, fingerprint),
    INDEX idx_guest_sessions_code     (code_id),
    CONSTRAINT fk_guest_sessions_code FOREIGN KEY (code_id) REFERENCES guest_codes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
