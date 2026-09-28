# Architecture du projet — ConnectBé

---

## 1. Vue d'ensemble

**But du projet** : ConnectBé est une plateforme SaaS de conciergerie digitale pour hôtels. Elle fournit une borne interactive tactile (kiosque) déployée dans les halls d'hôtels, ainsi qu'un backoffice de gestion multi-niveaux.

**Type de web app** : Application web full-stack multi-tenant (un hébergement, N hôtels).

**Stack technique** :

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite 6 (SPA) |
| Backend | Node.js 20 + Express 5 |
| Base de données | MySQL 8.0 |
| Cache | Redis 7 (ioredis) |
| Traduction auto | LibreTranslate (self-hosted) + MyMemory (fallback) |
| Conteneurisation | Docker Compose (5 services) |
| Auth | JWT HS256 (8h TTL) + bcrypt |

**Architecture globale** :

```
┌─────────────────────────────────────────────┐
│  Navigateur (React SPA — port 5173)          │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Kiosque     │  │  Backoffice Admin    │ │
│  │  /:hotelSlug │  │  /admin              │ │
│  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼────────────────────┼─────────────┘
          │ HTTP /api           │ HTTP /api/admin + Bearer JWT
          ▼                    ▼
┌─────────────────────────────────────────────┐
│  Express API (port 4001)                     │
│  helmet | cors | rateLimit | adminAuth       │
│  routes/ ── services/ ── models/             │
└──────────┬──────────────┬───────────────────┘
           │ mysql2       │ ioredis
           ▼              ▼
      MySQL 8.0       Redis 7
      (port 3307)    (port 6380)

  Appels externes :
  OWM (météo) · FlightAPI.io (vols) · open.er-api.com (devises)
  LibreTranslate (traduction) · OpenRouteService (carte)
```

---

## 2. Structure du code

```
HotelInteractivescreen/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.js                  Point d'entrée + wiring de toutes les routes
│       ├── middleware/             adminAuth, hotelContext, requireRole
│       ├── models/                 Wrappers DB (pas d'ORM, requêtes SQL directes)
│       ├── services/               Logique métier + tiers (DB, cache, APIs externes)
│       └── routes/
│           ├── *.js                Routes publiques (kiosk, météo, vols, devises…)
│           ├── kioskDevice.js      Inscription borne, auth silencieuse, heartbeat
│           └── admin/
│               ├── auth.js
│               ├── myNotifications.js
│               ├── backupRoutes.js Fabrique montée 2× (super + hotel)
│               ├── super/          15 modules super-admin (dont kiosks)
│               ├── hotel/          8 modules hotel-admin (dont kiosks)
│               └── contributor/    3 modules contributeur
├── frontend/
│   ├── Dockerfile
│   ├── vite.config.js              Proxy /api + /uploads → backend
│   └── src/
│       ├── App.jsx                 Routeur racine
│       ├── KioskApp.jsx            Routeur kiosque + gate d'auth borne + heartbeat
│       ├── contexts/               HotelContext, LanguageContext, ThemeContext
│       ├── services/               api.js (kiosque), analytics.js, hotelStore.js
│       ├── components/             Composants UI partagés + sections kiosque
│       ├── i18n/                   9 fichiers locale JSON + locales.json
│       └── admin/
│           ├── AdminApp.jsx        Routeur admin + guards
│           ├── AdminLogin.jsx
│           ├── AdminLayout.jsx     Shell avec sidebar
│           ├── useAdminApi.js      Client Axios admin (Bearer auto-inject)
│           ├── contexts/           AuthContext
│           ├── styles/             CSS Modules partagés (Manager.module.css…)
│           └── pages/
│               ├── BackupManager.jsx  Page partagée super/hotel (prop `variant`)
│               ├── super/          15 pages (dont KiosksManager)
│               ├── hotel/          8 pages (dont KiosksManager)
│               └── contributor/    4 pages
├── database/
│   ├── init.sql                    Schéma de base
│   └── migrations/                 001 à 013 (appliquées au démarrage)
├── uploads/                        Logos, images, fonts (volume Docker monté)
│   └── restored/                   Médias d'archives importées d'une autre instance
├── backups/
│   └── config/                     Instantanés du back-office (volume Docker monté)
├── docker-compose.yml
├── docker-compose.dev.yml          Surcouche dev : frontend sur serveur Vite
├── .env.example
└── scripts/
    ├── db-backup.sh                Dump complet (schéma + tout), hors git
    └── db-export.sh                Contenu éditorial → data_live.sql, versionné
```

**Rôle des dossiers clés** :

| Dossier | Rôle |
|---|---|
| `backend/src/routes/` | Définition des endpoints Express |
| `backend/src/services/` | Logique réutilisable (DB, cache, APIs tierces, cron) |
| `backend/src/models/` | Couche d'accès aux données (SQL brut, pas d'ORM) |
| `backend/src/middleware/` | Auth JWT, contexte hôtel, guards rôle |
| `frontend/src/contexts/` | État global React (hotel, langue, thème) |
| `frontend/src/services/api.js` | Client Axios kiosque + cache offline localStorage |
| `frontend/src/admin/useAdminApi.js` | Client Axios admin + Bearer JWT auto |
| `frontend/src/i18n/` | Traductions statiques (9 langues) |
| `uploads/` | Fichiers uploadés (logos, images POI/events, fonts, bannières) |
| `backups/config/` | Instantanés de configuration du back-office (20 derniers, hors git) |
| `database/migrations/` | 13 migrations SQL idempotentes appliquées au boot |

---

## 3. Frontend

**Framework** : React 18 + Vite 6 (SPA), React Router DOM v6.

### Routage racine (`App.jsx`)

```
/                        → Landing page projet
/mobile/:section         → MobileGate (validation token QR)
/admin/*                 → AdminApp (backoffice)
/:hotelSlug/visiteur/*   → GuestApp (accès client par code de séjour)
/:hotelSlug/*            → KioskApp (kiosque de l'hôtel)
```

La route visiteur est déclarée **avant** la route kiosque : sans cela `/visiteur`
serait avalé par `KioskApp` et soumis à l'inscription de borne.

### Kiosque — routes (`/:hotelSlug/`)

| Route | Composant |
|---|---|
| `/` | RadialMenu (accueil + attract screen) |
| `/weather` | Weather |
| `/flights` | Flights |
| `/map` | MapSection (Leaflet + OpenRouteService) |
| `/events` | Events |
| `/wellness` | Wellness |
| `/info` | UsefulInfo |
| `/mobile` | MobileTransfer (générateur QR) |
| `/feedback` | Feedback (formulaire multi-étapes) |
| `/currency` | CurrencyConverter |

### Visiteur — routes (`/:hotelSlug/visiteur/`)

Le client saisit le code reçu à l'enregistrement et retrouve le menu sur son
téléphone. Les composants de section sont **les mêmes** que ceux du kiosque : seul
l'habillage change (menu en liste au lieu du menu radial, pas d'`IdleTimer`, pas
d'`AttractScreen`, pas d'inscription d'appareil).

| Route | Composant |
|---|---|
| `/` (ou `?c=CODE`) | GuestGate (saisie / fin de séjour) puis GuestHome |
| `/weather` `/flights` `/map` `/events` `/wellness` `/info` `/currency` `/feedback` | mêmes composants que le kiosque |

`MobileTransfer` est volontairement absent : son rôle est d'envoyer la borne vers
un téléphone, ce qui n'a plus d'objet sur le téléphone du client.

### Stack de contexte — Kiosque

```
<LanguageProvider>       ← lazy-load JSON locale, RTL (<html dir>)
  <BrowserRouter>
    <KioskDeviceGate>    ← Auth borne (token localStorage par hôtel)
      │                     bypass=1 → skip | token absent → inscription
      │                     token OK → heartbeat 5 min | enabled=false → désactivée
      <HotelProvider>    ← GET /api/kiosk/:slug/config au boot
        <ThemeProvider>  ← CSS vars + auto dark mode 20h–7h
          <KioskRoutes>
            <KioskLayout>  ← AttractScreen, FullscreenManager,
                              bannière offline, IdleTimer (30s → home)
              <Section>    ← <SectionChrome /> en tête de page :
                              retour, météo, langue, thème
```

### Stack de contexte — Admin

```
<AuthProvider>           ← hydration JWT depuis sessionStorage
  <AdminLayout>          ← sidebar + shell
    <AdminPages>
```

### Gestion d'état

- **Pas de store global** (Redux/Zustand absent) : l'état est géré via React Context + hooks locaux.
- `HotelContext` : config hôtel chargée une fois au boot, accessible dans tout le kiosque **et dans l'espace visiteur**. Expose `isSectionEnabled(key)`, dérivé de `settings.enabled_sections` — c'est lui qui masque une section désactivée, menu et route comprises.
- `LanguageContext` : locale courante + fonction `t('key')` avec interpolation `{{var}}`.
- `ThemeContext` : injection dynamique de `--color-*` CSS custom properties depuis `theme_colors` JSON.
- `AuthContext` : JWT admin lu depuis `sessionStorage` (pas `localStorage`).

### Composants notables

| Composant | Rôle |
|---|---|
| `RadialMenu` | Écran d'accueil avec 3 zones de navigation |
| `AttractScreen` | Écran attractif après 30s d'inactivité |
| `IdleTimer` | Redirection home après inactivité |
| `FullscreenManager` | Mode plein écran avec sortie par mot de passe |
| `SectionChrome` | Barre de navigation de section (sticky, dans le flux) : retour, pastille météo, langue, thème. Seul point d'entrée — aucune page ne place de bouton flottant |
| `WeatherBadge` | Pastille météo, rendue à l'intérieur de `SectionChrome` |
| `MobileGate` | Validation du token QR pour transfert mobile |

### Mise en page des sections kiosque

- Chaque section rend `<SectionChrome />` en **premier enfant** de son conteneur racine (`.page` / `.detailPage` / `.shell`). La barre est `position: sticky` **dans le flux** : elle réserve sa hauteur, donc aucun contrôle ne peut chevaucher le contenu.
- Le conteneur racine déclare sa gouttière horizontale via `--page-pad-x` (ex. `--page-pad-x: clamp(20px, 4vw, 56px); padding: 0 var(--page-pad-x) …`). La barre s'en sert pour s'étendre bord à bord tout en alignant ses contrôles sur le contenu.
- Les `@media` d'une section ne surchargent que `--page-pad-x`, jamais `padding-top/left/right` du conteneur racine.
- Vue détail ou étape interne → `<SectionChrome onBack={…} backLabel={…} />` plutôt qu'un bouton retour maison : un seul retour, toujours au même endroit.

### Appels API

- **Kiosque** : `services/api.js` — Axios `baseURL: /api`, intercepteur qui injecte `hotel_id` en query param sur les GET, cache offline via `localStorage`.
- **Admin** : `useAdminApi.js` — Axios `baseURL: /api/admin`, intercepteur `Authorization: Bearer <token>`, redirection `/admin/login` sur 401.
- **Convention stricte** : les pages admin ne font **jamais** d'import `axios` direct — elles utilisent `useAdminApi.js`.

### Authentification frontend

- Login → POST `/api/admin/login` → JWT stocké dans `sessionStorage`.
- `RequireAuth` : vérifie la présence du JWT avant de rendre les routes admin.
- `RequireRole` : vérifie le rôle dans le payload JWT pour les sections super/hotel/contributor.

### Internationalisation (i18n)

- 9 locales : `fr`, `en`, `de`, `es`, `pt`, `ar`, `zh`, `ja`, `ru`.
- Fichiers JSON chargés à la demande (lazy) au changement de langue.
- Arabe : `dir="rtl"` appliqué dynamiquement sur `<html>`.

---

## 4. Backend / API

### Point d'entrée

`backend/src/app.js` : monte tous les routeurs, configure les middlewares globaux, démarre les services background.

### Middlewares globaux

```
helmet()           → Headers HTTP sécurité
cors('*')          → CORS ouvert (tous les origins)
express.json()     → Parsing JSON
rateLimit          → 200 req/min global
```

### Chaîne middleware pour les routes admin

```
Request
  → adminAuth.js      (vérifie JWT → req.user)
  → hotelContext.js   (req.hotelId = req.user.hotel_id)
  → requireRole(...)  (403 si rôle absent)
  → handler
```

### Rôles utilisateur

| Rôle | Périmètre |
|---|---|
| `super_admin` | Toutes les ressources, tous les hôtels |
| `hotel_admin` | Son hôtel uniquement |
| `hotel_staff` | Réception — sous-ensemble lecture/écriture de son hôtel, dont les codes d'accès client |
| `contributor` | Ses propres contenus (POI, events, info) soumis en workflow |

### Structure des routes

```
/api/
  weather/, flights/, events/, wellness/, poi/, info/,
  tips/, kiosk/, hotels/public, currency/, analytics/,
  qr/, theme/, feedback/, translate/
  kiosk-device/
    ├── POST register    Inscription borne (clé usage unique)
    ├── POST auth        Auth silencieuse au démarrage
    └── PUT  heartbeat   Signal de vie toutes les 5 min
  guest/                 Accès client par code de séjour (public, débit limité 8/min)
    ├── POST redeem      Échange code → guest_token (consomme un slot d'appareil)
    ├── POST qr          Valide un code et rend l'URL à encoder, SANS session
    └── GET  me          Wi-Fi, check-out, bienvenue nominative (guest_token requis)
  └── admin/
      ├── login
      ├── notifications/
      ├── super/
      │   ├── hotels/, users/, airports/, places/, events/,
      │   │   info/, service-categories/, poi-categories/,
      │   │   event-categories/, info-categories/, weather/,
      │   │   tokens/, audit-log/
      │   ├── kiosks/    Liste bornes, clés d'inscription, toggle, suppression
      │   └── backup/    Sauvegarde/restauration — tous périmètres
      ├── hotel/
      │   ├── settings/, banner-images/, services/, tips/,
      │   │   events/, feedbacks/, devise/
      │   ├── kiosks/    Liste bornes de l'hôtel, toggle actif/inactif
      │   ├── guest-codes/  Codes d'accès client : création (unitaire ou en lot),
      │   │                 prolongation, révocation, appareils rattachés
      │   └── backup/    Sauvegarde/restauration — son établissement (hotel_admin)
      └── contributor/
          ├── places/, events/, info/
```

(Voir section 6 pour les endpoints complets)

### Services backend

| Service | Fichier | Rôle |
|---|---|---|
| DB pool | `services/db.js` | Pool mysql2 (utf8mb4, 10 connexions max) |
| Cache | `services/cacheService.js` | Wrapper ioredis avec dégradation gracieuse |
| Migrations | `services/runMigrations.js` | 15 migrations SQL idempotentes au démarrage |
| Météo | `services/weatherRefresh.js` | Fetch OWM toutes les 8h (0h, 8h, 16h, 20h) |
| Vols | `services/flightRefresh.js` | Fetch FlightAPI.io selon planning par aéroport |
| Devises | `services/currencyService.js` | Cascade 3 providers + cache Redis partagé 1h |
| Archive | `services/archiveService.js` | Archivage auto des événements passés (minuit) |
| Crédits | `services/creditTracker.js` | Compteur crédits FlightAPI dans `theme_config` |
| **KioskMonitor** | `services/kioskMonitor.js` | Cron 5 min — détecte les bornes sans heartbeat > 10 min et insère une notification backoffice |
| **configBackup** | `services/configBackup/` | Export/import de la configuration et du contenu en archive `.zip`. `schema.js` décrit déclarativement les 29 tables sauvegardées, `index.js` porte le moteur (export, essai à blanc, import transactionnel, instantanés serveur). Ajouter une table à la sauvegarde = ajouter un descripteur, sans toucher au moteur. |

### Sécurité

- JWT HS256, TTL 8h, secret via `JWT_SECRET` env var.
- Mots de passe : bcrypt (cost=10).
- Rate limiting feedback : 5 req/15min burst + 300 req/24h par IP + hôtel.
- Uploads : validation magic bytes (JPEG, PNG, WebP, GIF, BMP) + limite 5 MB images / 4 MB fonts.
- Soft-delete sur hôtels et utilisateurs (`is_active = 0`).
- Audit log : chaque action CRUD super-admin trace `old_value`/`new_value` JSON.

---

## 5. Données et persistance

**Base de données** : MySQL 8.0 (charset `utf8mb4`).

### Tables principales

| Table | Rôle |
|---|---|
| `hotels` | Hôtels (slug, nom, is_active) |
| `admin_users` | Utilisateurs backoffice (email, hash, rôle, hotel_id, permissions) |
| `hotel_settings` | Config par hôtel (branding, contacts, thème JSON, fonts, welcome_message × 9 langues) |
| `points_of_interest` | POI avec workflow (status, created_by, rejection_reason) |
| `poi_translations` | Traductions POI (poi_id × locale) |
| `poi_images` | Max 3 images par POI |
| `events` + `event_translations` | Événements avec workflow + archivage auto |
| `services` + `service_translations` | Services par hôtel avec catégorie |
| `hotel_tips` | Bons à savoir (fr/en directs, autres dans `translations_json` TEXT) |
| `useful_contacts` + `useful_contact_translations` | Contacts utiles avec workflow |
| `localities` | Villes météo (OWM city_id + lat/lng) |
| `hotel_weather_localities` | N:N hôtels ↔ localités (max 5, ordre affichage, défaut) |
| `airports` | Aéroports IATA + config planning (interval/fixed_hours) |
| `hotel_airports` | N:N hôtels ↔ aéroports |
| `devise_config` | Config devises par hôtel (base, cibles, taux JSON, mode auto) |
| `feedbacks` | Retours kiosque (catégories JSON, note globale, IP) |
| `kiosks` | Bornes enregistrées (device_token, fingerprint, label, is_enabled, last_seen_at, offline_notified_at) |
| `kiosk_keys` | Clés d'inscription générées (key_value, hotel_id, expires_at, used_at, created_by) |
| `guest_codes` | Codes d'accès client par séjour (code, chambre, nom, occupants, max_devices, fenêtre de validité, grace_hours, revoked_at, anonymized_at) |
| `guest_sessions` | Appareils rattachés à un code (token_hash SHA-256, fingerprint, first/last_seen_at, revoked_at) — index unique (code_id, fingerprint) |
| `analytics_events` | Événements analytiques kiosque/mobile |
| `qr_tokens` | Tokens UUID avec TTL (10 min) |
| `hotel_banner_images` | Images bannière par hôtel (max 10) |
| `workflow_notifications` | Notifications de workflow (auteur → super-admin → auteur) |
| `audit_log` | Journal des actions admin (entity, old/new JSON) |
| `api_token_tracking` | Compteur crédits API par service |

### Relations importantes

```
hotels ──< hotel_settings        (1:1)
hotels ──< admin_users           (1:N, NULL pour super_admin)
hotels ──< hotel_places          (N:N via hotel_places)
hotels ──< hotel_airports        (N:N)
hotels ──< hotel_weather_localities (N:N, max 5)
hotels ──< services              (1:N)
hotels ──< hotel_tips            (1:N)
hotels ──< hotel_banner_images   (1:N, max 10)
hotels ──< devise_config         (1:1)
hotels ──< kiosks               (1:N)
hotels ──< kiosk_keys           (1:N)
admin_users ──< workflow_notifications (1:N recipient)
poi_categories.hotel_id = NULL → catégorie globale
event_categories.hotel_id = NULL → catégorie globale
```

### Migrations

Les migrations sont appliquées automatiquement à chaque démarrage du backend via `runMigrations.js`, toutes idempotentes (contrôle via `information_schema.COLUMNS` et `information_schema.TABLES`). Le tableau `MIGRATIONS` va de `003` à `019` ; les plus récentes créent les tables `guest_codes` / `guest_sessions` (`018`) et ajoutent `hotel_settings.enabled_sections` (`019`).

> La numérotation du runner JS est **indépendante** de celle du dossier `database/migrations/` : `015_guest_codes.sql` correspond à `migration018()`, `016_enabled_sections.sql` à `migration019()`. Une migration déposée dans le dossier ne s'applique nulle part tant qu'elle n'a pas son pendant dans le runner — voir [`database/migrations/README.md`](database/migrations/README.md).

### Catalogues partagés backend ↔ frontend

Deux listes de référence ne vivent ni en base ni en double dans le frontend :

| Fichier | Contenu | Servi par |
|---|---|---|
| `backend/src/data/currencies.json` | Catalogue des devises du convertisseur | `GET /api/currency/*` et le back-office Devises |
| `backend/src/data/sections.json` | Catalogue des sections du kiosque (clé, libellés FR/EN, route, description) | `GET /api/admin/super/hotels/sections/catalog` |

Le frontend ne code aucune de ces listes en dur : il les récupère par HTTP. Une section
s'ajoute donc dans `sections.json`, et le sélecteur du back-office l'affiche sans autre
changement. Côté hôtel, `hotel_settings.enabled_sections` (tableau JSON de clés, `NULL` =
toutes) filtre ce que la borne et l'espace visiteur affichent —
`normalizeEnabledSections()` / `parseEnabledSections()` en assurent la lecture et l'écriture
(`backend/src/data/sections.js`).

### Stockage externe

- **Redis** : cache météo (10 min + fallback 30j), vols (sans TTL), devises (1h), config kiosque (5 min).
- **Filesystem `./uploads/`** : logos, backgrounds, fonts, images POI/events/services/bannières — monté comme volume Docker. Résolu via `UPLOADS_DIR`, défaut `/uploads` en conteneur.
- **Filesystem `./backups/config/`** : instantanés de configuration créés par le back-office (20 derniers, purge automatique). Résolu via `CONFIG_BACKUP_DIR`, défaut `/backups/config`. **Doit être un volume monté** — sinon les instantanés disparaissent à la recréation du conteneur.
- **Pas de CDN ni stockage objet** (S3, etc.) — stockage local uniquement.

### Identité d'instance

La clé `instance_id` de `theme_config` porte un UUID généré au premier usage du module de
sauvegarde. Elle est **exclue des exports** et protégée des purges : c'est elle qui permet de
distinguer une restauration sur place (les médias restent à leur emplacement) d'un import venu
d'une autre installation (les médias sont rangés dans `uploads/restored/<date>/`, pour ne pas
écraser un fichier homonyme en service).

---

## 6. Flux métier principaux

### Flux 1 — Démarrage du kiosque

```
Navigateur charge /:hotelSlug
  → HotelProvider : GET /api/kiosk/:slug/config
      ← settings + airports + banner_images (Redis 5min)
  → ThemeProvider : injection CSS vars depuis theme_colors JSON
  → LanguageProvider : charge fr.json (défaut)
  → RadialMenu s'affiche
  → IdleTimer : 30s sans interaction → AttractScreen
```

### Flux 2 — Affichage météo

```
Kiosque ouvre /weather
  → GET /api/weather/current?hotel_id=&locality_id=
      → cacheService.get(`weather:locality:{id}`)
          HIT  → retourne données Redis
          MISS → OWM API → Redis set (TTL 10min) → retourne
  → WeatherSection affiche current + forecast + UV
```

### Flux 3 — Soumission et validation d'un POI (workflow contributeur)

```
Contributeur (front admin)
  → POST /api/admin/contributor/places
      → status = 'pending'
      → INSERT workflow_notification (type: new_submission, to: super_admin)

Super-admin reçoit notification
  → POST /api/admin/super/places/:id/publish
      → UPDATE status = 'published'
      → INSERT workflow_notification (type: published, to: author)
  OU
  → POST /api/admin/super/places/:id/reject  { reason }
      → UPDATE status = 'rejected', rejection_reason
      → INSERT workflow_notification (type: rejected, to: author)

Contributeur voit le résultat dans MyPlaces
  (peut re-soumettre → status = 'pending' à nouveau)
```

### Flux 4 — Conversion de devises

```
Kiosque ouvre /currency
  → GET /api/currency/config?hotel_id=      ← base + display_currencies
  → GET /api/currency/rates?hotel_id=        ← matrice cross-rate (max 5 devises)
      → currencyService.getRates(hotelId)
          Redis hit `currency:rates:shared:{base}` (TTL 1h)
            OU
          Cascade 3 providers : open.er-api.com → fawazahmed0 CDN → exchangerate-api.com
          → Redis set + UPDATE devise_config.rates

Utilisateur saisit montant
  → GET /api/currency/convert?amount=&hotel_id=   ← calcul côté backend
```

### Flux 5 — Transfert mobile (QR code)

```
Utilisateur kiosque appuie "Envoyer sur mon téléphone"
  → POST /api/qr/token  { hotel_id, section, data }
      → INSERT qr_tokens (uuid, TTL 10min)
      ← { token, url: /mobile/:section?token=uuid }
  → MobileTransfer affiche QR code (url encodée)

Utilisateur scanne le QR sur son mobile
  → GET /api/qr/validate/:token
      → SELECT qr_tokens WHERE uuid = token AND expires_at > NOW()
      ← { valid: true, section, data }
  → MobileGate redirige vers /:section avec les données pré-chargées
```

### Flux 6 — Inscription et monitoring d'une borne kiosque

```
Super-admin génère une clé (hotel_id + expiration)
  → POST /api/admin/super/kiosks/keys
      → INSERT kiosk_keys (key_value, hotel_id, expires_at, created_by)

Technicien saisit la clé sur l'écran d'inscription (KioskRegistration)
  → POST /api/kiosk-device/register { key, fingerprint, hotel_slug }
      → Vérifie : clé existante + non utilisée + non expirée + hotel_slug correspond
      → INSERT kiosks (hotel_id, device_token, fingerprint)
      → UPDATE kiosk_keys SET used_at = NOW()
      ← { device_token, hotel_slug }
  → localStorage.setItem('connectbe_device_token_<slug>', device_token)
  → Interface kiosque s'affiche

-- Démarrages suivants --

Navigateur recharge /:hotelSlug
  → KioskDeviceGate lit device_token depuis localStorage
  → POST /api/kiosk-device/auth { device_token }
      → Vérifie token → retourne { enabled, hotel_slug }
  Si enabled=false → écran "Borne désactivée"
  Si enabled=true  → KioskApp s'affiche
  → setInterval heartbeat (5 min)

-- Heartbeat --

PUT /api/kiosk-device/heartbeat (Authorization: Bearer <device_token>)
  → UPDATE kiosks SET last_seen_at = NOW(), offline_notified_at = NULL
  ← { enabled }
  Si enabled=false → interface passe en écran désactivé en temps réel

-- Monitoring (KioskMonitor, cron 5 min) --

SELECT bornes is_enabled=1 AND last_seen_at < NOW() - 10min AND offline_notified_at IS NULL
  → Pour chaque borne hors ligne :
      INSERT workflow_notifications (super_admin + hotel_admin de l'hôtel)
      UPDATE kiosks SET offline_notified_at = NOW()
```

### Flux 7 — Accès client par code de séjour

```
-- Création (réception / hotel_admin / super_admin) --

POST /api/admin/hotel/guest-codes { room_number, guest_name, occupants, valid_from, valid_until }
  → code 6 caractères base32 sans ambiguïté (ni 0/O ni 1/I/L), unique par hôtel
  → INSERT guest_codes (grace_hours = 24 par défaut, max_devices = occupants, plancher 2)
  → INSERT audit_log (entity_type = 'guest_code')
  ← fiche imprimable A5 : QR + code + URL

-- Échange du code (téléphone du client) --

POST /api/guest/redeem { hotel_slug, code, fingerprint }
  → fenêtre de validité = [valid_from, valid_until + grace_hours]
  → même fingerprint déjà vu → réveil de la session (pas de second slot consommé)
  → sinon quota max_devices vérifié DANS la transaction
  → INSERT/UPDATE guest_sessions (token_hash = SHA-256, jamais le jeton en clair)
  ← guest_token (JWT, exp = fin d'accès réelle)

Causes de refus distinctes, pour que le front sache quoi afficher :
  upcoming | expired | revoked | device_limit | rate_limited | invalid
  expired/revoked → écran « Séjour terminé » avec remerciement, pas une erreur de saisie

-- QR affiché à la borne ou à la réception --

POST /api/guest/qr { hotel_slug, code }
  → valide le code SANS créer de session : la borne n'entame pas le quota du client
  ← { path: '/<slug>/visiteur?c=CODE' }  — aucune donnée nominative renvoyée :
    l'écran est visible de tout le hall

-- Garde des routes de contenu (contentAuth) --

Porteurs acceptés : guest_token (JWT) | device_token de borne (96 hex) | qr_token (UUID)
  + cloisonnement : un jeton d'un hôtel ne lit pas les données d'un autre,
    même en changeant ?hotel_id
  CONTENT_AUTH_ENFORCE=false → mode observation (appels sans jeton tolérés et
    journalisés, une fois par minute et par chemin)

-- Données réservées au client authentifié --

GET /api/guest/me → Wi-Fi (nom + mot de passe), check-out, bienvenue nominative
/api/kiosk/:slug/config reste public MAIS expurgé de wifi_password et
fullscreen_password : ces deux secrets partaient auparavant à tout appelant

-- Purge RGPD (archiveService, passage nocturne) --

GUEST_RETENTION_DAYS (30) après la fin d'accès :
  DELETE guest_sessions (empreinte, user-agent, IP)
  UPDATE guest_codes SET guest_name = NULL, anonymized_at = NOW()
  → les statistiques d'usage par chambre survivent, l'identité non
```

---

## 7. Dépendances et couplages

### Dépendances critiques entre modules

| Dépendant | Dépend de | Nature |
|---|---|---|
| Toutes routes admin | `adminAuth.js` | Auth obligatoire |
| Routes hotel/ | `hotelContext.js` | Scoping hôtel |
| `currencyService.js` | Redis + 3 APIs externes | Cascade fallback |
| `weatherRefresh.js` | Redis + OWM | Cache obligatoire |
| `flightRefresh.js` | Redis + FlightAPI.io | Persist sans TTL |
| `KioskApp.jsx` | `HotelContext` | Config au boot |
| `KioskDeviceGate` | API `kiosk-device` + localStorage | Auth borne au boot + heartbeat |
| `kioskMonitor.js` | `workflow_notifications` + `kiosks` | Notifications dépendent du schéma DB |
| `ThemeProvider` | `HotelContext` | CSS vars depuis settings |
| Toutes pages admin | `useAdminApi.js` | Axios admin centralisé |
| `hotelStore.js` | `HotelContext` | Bridge singleton → Axios interceptor |

### Composants fortement couplés

- `ThemeContext` ↔ `HotelContext` : le thème dépend des données hôtel chargées dans HotelContext.
- `api.js` ↔ `hotelStore.js` : le client Axios kiosque lit `hotel_id` depuis le singleton pour éviter une dépendance circulaire avec HotelContext.
- `runMigrations.js` ↔ schéma DB : les migrations vérifient `information_schema` — un changement de nom de table/colonne peut bloquer le démarrage.

### Services partagés

- **Redis** : partagé entre météo, vols, devises, config kiosque (clés préfixées par domaine).
- **MySQL pool** (`db.js`) : utilisé par tous les modèles et routes sans abstraction ORM.
- **`cacheService.js`** : wrapper centralisé — si Redis est absent, dégradation gracieuse (pas de crash).

### Points sensibles / risques

| Risque | Description |
|---|---|
| Pas d'ORM | Les requêtes SQL sont écrites à la main dans les routes/modèles — risque de divergence et de SQL injection si `escape()` est oublié. |
| `cors('*')` | CORS complètement ouvert — acceptable en développement, à restreindre en production. |
| JWT dans `sessionStorage` | Vulnérable aux attaques XSS si du code tiers est injecté dans le DOM. |
| Uploads sur filesystem local | Pas de réplication — perte des fichiers si le volume Docker est supprimé. |
| Redis sans auth | Le redis Docker n'a pas de mot de passe configuré dans le compose. |
| `theme_config` table legacy | Encore utilisée pour le compteur de crédits FlightAPI — couplage résiduel avec l'ancien système mono-hôtel. |
| Traductions `translations_json` TEXT | Les tips ont fr/en en colonnes directes, les autres langues dans un champ TEXT JSON non structuré — difficile à requêter. |

---

## 8. Qualité et évolutivité

### Points forts

- **Architecture multi-tenant propre** : isolation par `hotel_id` dans le JWT et dans toutes les requêtes.
- **Cache Redis bien pensé** : TTL adaptés par domaine, dégradation gracieuse, fallback DB pour la météo.
- **Migrations idempotentes automatiques** : le schéma se met à jour au démarrage sans intervention manuelle.
- **Workflow de validation clair** : circuit contributeur → super-admin bien délimité avec notifications.
- **Client API centralisé** : `useAdminApi.js` et `api.js` évitent la duplication de logique auth/retry.
- **i18n complet** : 9 langues, lazy-loading, RTL, welcome messages par langue dans les settings hôtel.
- **Sécurité upload solide** : validation magic bytes + limite taille + typage MIME strict.

### Limites observées

1. **Pas d'ORM** — Requêtes SQL brutes dispersées dans les routes et modèles. Maintenance difficile, risque de régression sur les requêtes complexes.
2. **Pas de tests automatisés** — Aucun fichier de test identifié dans le codebase (ni Jest, ni Vitest, ni Supertest).
3. **CORS ouvert** — `cors('*')` doit être restreint avant mise en production.
4. **Stockage local pour les uploads** — Pas de stratégie de backup ou de réplication des fichiers.
5. **Redis sans authentification** — Service exposé sans mot de passe dans le docker-compose.
6. **`translations_json` TEXT non structuré** — Les traductions des tips pour les langues non-principales sont stockées en JSON sérialisé dans un champ TEXT, ce qui empêche toute requête SQL et rend les migrations de contenu difficiles.
7. **État admin en `sessionStorage`** — Le JWT est perdu à la fermeture de l'onglet ; acceptable mais limité (pas de "rester connecté").
8. **Pas de versioning d'API** — Pas de préfixe `/v1/` ou `/v2/` ; les changements breaking cassent directement les clients.

### Recommandations (par priorité)

| Priorité | Recommandation |
|---|---|
| 🔴 1 | **Restreindre CORS** en production (whitelister les domaines frontend uniquement). |
| 🔴 2 | **Ajouter un mot de passe Redis** dans le docker-compose + `REDIS_PASSWORD` env var. |
| 🔴 3 | **Écrire des tests d'intégration** sur les routes critiques (auth, workflow, devises, uploads) avec Supertest + une DB de test. |
| 🟠 4 | **Migrer `translations_json`** vers une table `hotel_tip_translations` (pattern déjà utilisé pour POI/events). |
| 🟠 5 | **Introduire un ORM léger** (ex. Knex.js) ou a minima un query builder pour centraliser les requêtes et éviter les injections. |
| 🟠 6 | **Externaliser les uploads** vers un stockage objet (S3-compatible) pour la résilience et la scalabilité horizontale. |
| 🟡 7 | **Versionner l'API** (`/api/v1/`) pour permettre des évolutions sans régression. |
| 🟡 8 | **Ajouter un logger structuré** (ex. Pino) à la place des `console.log` pour faciliter le monitoring en production. |
| 🟡 9 | **Mettre en place un CI/CD** (lint, tests, build Docker) sur chaque push vers `main`. |

---

## 9. Glossaire

| Terme | Définition |
|---|---|
| **Kiosque** | Interface tactile grand écran déployée dans un hôtel, accessible via `/:hotelSlug`. |
| **Backoffice** | Interface d'administration web accessible via `/admin`. |
| **Slug** | Identifiant URL unique de l'hôtel (ex. `hotel-ivoire`), utilisé pour router vers le bon kiosque. |
| **HotelContext** | Contexte React contenant la config complète de l'hôtel courant (settings, aéroports, bannières). |
| **ThemeContext** | Contexte React qui injecte les CSS custom properties (`--color-*`) dérivées de `theme_colors` JSON. |
| **useAdminApi** | Hook React qui retourne une instance Axios préconfigurée pour l'API admin (Bearer JWT, redirect 401). |
| **Workflow** | Circuit de validation des contenus soumis par les contributeurs : pending → published/rejected. |
| **Attract Screen** | Écran animé qui se déclenche après 30s d'inactivité sur le kiosque pour attirer l'attention. |
| **MobileGate** | Page dédiée à la validation d'un token QR permettant de transférer une section du kiosque vers mobile. |
| **runMigrations** | Service backend qui applique au démarrage les migrations SQL idempotentes (vérification via `information_schema`). |
| **cacheService** | Wrapper Redis avec dégradation gracieuse : si Redis est indisponible, les opérations échouent silencieusement. |
| **Magic bytes** | Validation des fichiers uploadés par leur signature binaire (premiers octets) plutôt que par l'extension. |
| **super_admin** | Rôle administrateur global avec accès à tous les hôtels et toutes les ressources. |
| **hotel_admin** | Administrateur d'un hôtel spécifique (branding, services, tips, events, feedbacks, devises). |
| **contributor** | Utilisateur externe qui soumet des POI, événements ou contacts utiles via un workflow de validation. |
| **is_notification** | Flag booléen sur `hotel_tips` qui marque un tip comme notification (affichage avec icône clochette). |
| **Localities** | Villes liées à un hôtel pour l'affichage météo (max 5, avec une localité par défaut). |
| **Devise config** | Configuration des devises d'un hôtel : devise de base, devises cibles, taux de change, mode de mise à jour. |
| **KioskDeviceGate** | Composant React qui intercepte le rendu du kiosque pour vérifier l'authentification de la borne (token, bypass, état désactivé). |
| **device_token** | Token opaque (96 chars hex) délivré à une borne lors de son inscription, stocké dans localStorage sous la clé `connectbe_device_token_<slug>`. |
| **heartbeat** | Signal `PUT /api/kiosk-device/heartbeat` envoyé toutes les 5 minutes par la borne pour indiquer qu'elle est en ligne. |
| **KioskMonitor** | Service backend (cron 5 min) qui détecte les bornes sans heartbeat depuis plus de 10 minutes et envoie une notification backoffice. |
| **bypass mode** | Mode test activé via `?bypass=1` dans l'URL du kiosque — court-circuite la vérification du device_token. Réservé au développement. |
| **kiosk_key** | Clé d'inscription à usage unique (format `XXXXXX-XXXXXX-XXXXXX`) générée par le super-admin, liée à un hôtel et dotée d'une expiration. |
