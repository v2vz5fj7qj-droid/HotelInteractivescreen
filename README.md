# ConnectBé — Borne Interactive Hôtel (Multi-hôtels)

Concierge numérique tactile — plateforme SaaS multi-hôtels.

> Pour le démarrage rapide, voir [QUICKSTART.md](QUICKSTART.md).

---

## Branches

| Branche | Description |
|---|---|
| `backup/single-hotel-v1` | Version mono-hôtel figée — point de retour garanti |
| `main` | Version mono-hôtel stable |
| `feat/multi-hotel` | **Branche active** — migration architecture multi-hôtels |

---

## Architecture

```
HotelInteractivescreen/
├── frontend/          React 18 + Vite 6 (borne kiosque + backoffice admin)
├── backend/           Node.js / Express (API REST)
├── database/          Schéma MySQL + seeds + migrations
├── uploads/           Fichiers uploadés (logos, images POI) — persisté via volume Docker
├── docker-compose.yml Stack complète (MySQL, Redis, backend, frontend)
└── .env.example       Variables d'environnement à copier
```

## Ports

| Service          | Port hôte | Port interne |
|------------------|-----------|--------------|
| Frontend (borne) | **5173**  | 80 (nginx)   |
| Backend API      | **4001**  | 4000         |
| MySQL            | **3307**  | 3306         |
| Redis            | **6380**  | 6379         |
| LibreTranslate   | interne   | 5000         |

---

## Stack technique

| Couche      | Technologies                                                                                      |
|-------------|---------------------------------------------------------------------------------------------------|
| Frontend    | React 18, Vite 6, React Router 6, CSS Modules, Lucide, axios                                     |
| Carte       | Leaflet 1.9 + react-leaflet 4.2, tuiles CartoDB (clé gratuite carto.com — sans clé, la tuile affiche "API KEY REQUIRED") |
| QR code     | qrcode.react (kiosque) + qrcode (backend) — token signé TTL 10 min                               |
| Export PDF  | jsPDF 4 + jspdf-autotable 5 — génération PDF côté client (FeedbackManager)                       |
| Backend     | Node.js, Express, JWT (jsonwebtoken), multer, bcrypt, helmet, express-rate-limit, axios           |
| BDD         | MySQL 8, Redis (cache partagé inter-hôtels), ioredis                                             |
| Traduction  | LibreTranslate (auto-hébergé, 9 langues, aucune clé API requise)                                 |
| Infra       | Docker Compose, Nginx (production)                                                                |
| APIs        | OpenWeatherMap, FlightAPI.io, OpenRouteService                                                    |

---

## Rôles et périmètres

### SUPER_ADMIN
- **Configuration hôtel** : page dédiée par hôtel (paramètres, branding, météo, aéroports) accessible depuis la liste des hôtels via le bouton "Configurer"
- Carte : CRUD complet, affectation lieux → hôtels, **consultation détaillée des soumissions** avant validation (coordonnées GPS, lien OpenStreetMap, informations contributeur)
- Météo : définir localités par hôtel (max 5), cache partagé inter-hôtels par localité
- Vols : clé API FlightAPI.io, affectation aéroports par hôtel, planification par aéroport (intervalle ou heures fixes), désactivation planification (manuel uniquement), rafraîchissement forcé, suivi consommation tokens
- Agenda : CRUD global + modifier/supprimer tout événement (y compris ceux des hôtels et contributeurs), **consultation détaillée** avant validation ou rejet
- Infos utiles : **consultation détaillée des soumissions** avant validation, CRUD complet
- Services et bien-être : créer catégories globales "modèles" réutilisables par tous les hôtels
- Users : gestion comptes, rôles, permissions modules des contributeurs

### HOTEL_ADMIN
- Paramètres hôtel : logo, image de fond, thème couleurs, informations générales
- Services et bien-être : créer ses propres catégories + réutiliser catégories globales, CRUD de ses services
- Bon à savoir : CRUD complet (contenu propre à l'hôtel)
- Agenda : CRUD de ses propres événements (visibles hôtel uniquement, sans validation)
- Pré-validation : soumissions contributeurs liées à son hôtel (carte, agenda, infos utiles)
- Dashboard : notifications de workflow (soumissions en attente)

### HOTEL_STAFF
- Agenda : soumettre des événements → validation super-admin
- Bon à savoir / Services : lecture seule
- Dashboard : notifications en lecture

### CONTRIBUTOR (transversal — non rattaché à un hôtel)
Permissions modulaires activées par le super-admin :
- `can_submit_places` : soumettre/modifier ses lieux → validation
- `can_submit_events` : soumettre/modifier ses événements → validation
- `can_submit_info` : soumettre/modifier ses infos utiles → validation

---

## Workflow de validation (contenu contributeurs et staff)

```
CONTRIBUTOR / HOTEL_STAFF
        │  soumet  (status: pending)
        ▼
  Notification dashboard → HOTEL_ADMIN concerné
        │
        ├──► HOTEL_ADMIN pré-valide (status: pre_approved) ou rejette
        │
        ▼
  Notification dashboard → SUPER_ADMIN
        │
        ├──► SUPER_ADMIN consulte le détail complet (modal Voir)
        │         → champs, coordonnées GPS, lien carte, historique
        ├──► SUPER_ADMIN publie (status: published)
        ├──► SUPER_ADMIN rejette avec motif (status: rejected + motif notifié à l'auteur)
        └──► SUPER_ADMIN peut court-circuiter la pré-validation
        │
        ▼
  Notification dashboard → auteur (publié ou rejeté + motif)
```

Les contenus créés directement par HOTEL_ADMIN (événements, services, bon à savoir) sont publiés immédiatement sans validation — visibles uniquement pour leur hôtel. Le SUPER_ADMIN peut les modifier ou supprimer à tout moment.

---

## Fonctionnalités de la borne

| Section              | Route        | Description                                                                                   |
|----------------------|--------------|-----------------------------------------------------------------------------------------------|
| Menu d'accueil       | `/`          | 3 zones : bannière carrousel, cartes de service, widget météo cliquable — rotation des "Bon à savoir" (icône clochette si `is_notification`) |
| Météo                | `/weather`   | Météo actuelle + prévisions 5 jours + alertes saisonnières (OpenWeatherMap)                   |
| Vols                 | `/flights`   | Arrivées/départs multi-aéroports par hôtel, recherche par numéro de vol                       |
| Services             | `/wellness`  | Services spa/massage/piscine avec horaires et tarifs                                          |
| Agenda               | `/events`    | Événements globaux + propres à l'hôtel, filtres par catégorie                                 |
| Carte & POI          | `/map`       | Carte Leaflet interactive, bulle de détail avec galerie d'images (max 3 par POI)              |
| Infos utiles         | `/info`      | Contacts urgences, taxis, ambassades, pharmacies                                              |
| Transfert mobile     | `/mobile`    | QR code avec token signé TTL 10 min pour continuer sur smartphone                            |
| Évaluations          | `/feedback`  | Formulaire multi-étapes : notation étoilée par catégorie, commentaire libre, emojis rapides   |
| Devises              | `/currency`  | Tableau des taux de change (max 5 devises) + convertisseur interactif (40+ devises, open.er-api.com) |

Les sections affichées sur la borne sont **configurables par hôtel** (`hotel_settings.enabled_sections`) : le catalogue de référence vit dans `backend/src/data/sections.json`, et une valeur nulle signifie « toutes les sections ».

Les mêmes sections sont servies sur le téléphone du client via l'**espace visiteur** (`/<slug-hôtel>/visiteur`) — voir [Accès client par code de séjour](#accès-client-par-code-de-séjour).

**Fonctionnalités transversales :**
- Multilingue 9 langues : FR, EN, DE, ES, PT, AR (RTL), ZH, JA, RU
- Sélecteur de langue dans la barre de navigation basse — dropdown vers le haut
- Architecture i18n extensible : ajouter une langue = 1 fichier JSON + 1 ligne dans `locales.json`
- Mode offline (Service Worker + cache localStorage)
- Cache vols et météo partagé inter-hôtels (Redis) — un seul appel API par aéroport/localité
- Mode nuit automatique (sombre 20h–7h, clair 7h–20h)
- Attract screen après 30s d'inactivité sur l'accueil
- Retour automatique à l'accueil après 30s d'inactivité sur toute autre page
- Animations de transition entre pages
- Barre de section unique en tête de chaque page secondaire (`SectionChrome`) : retour, pastille météo, langue, thème — dans le flux, jamais en flottant au-dessus du contenu
- Sections activables par hôtel : chaque section du catalogue (`backend/src/data/sections.json`) peut être masquée depuis la configuration de l'hôtel
- Raccourci admin caché : 5 taps sur le logo → `/admin`
- Mode plein écran protégé par mot de passe (sortie bloquée sans code — configurable dans le thème)
- QR code avec token signé (TTL 10 min, auto-renouvelé) → page `/mobile/:section?token=…` sur smartphone

---

## Backoffice admin

| Niveau | URL d'accès |
|---|---|
| Super-admin | `/admin/super/` |
| Hôtel | `/admin/hotel/:slug/` |
| Contributeur | `/admin/contributor/` |

### Super-admin

| Page | Fonctionnalité |
|---|---|
| Tableau de bord | Vue globale, notifications de workflow (soumissions en attente) |
| Hôtels | CRUD hôtels (nom, slug, statut) + bouton **Configurer** par hôtel |
| Utilisateurs | CRUD comptes, rôles, permissions contributeurs |
| Carte & Lieux | CRUD lieux, **modal détail** (coordonnées, carte OSM, contributeur, historique rejet) avant validation/rejet, affectation → hôtels |
| Agenda | CRUD événements globaux, **modal détail** (titre, description, dates, lieu, contributeur) avant validation/rejet/archivage |
| Infos utiles | CRUD, **modal détail** (contacts, description, contributeur) avant validation/rejet |
| Services & bien-être | Catégories modèles globales réutilisables par les hôtels |
| Catégories (sous-menu) | Gestion des catégories globales : **Lieux**, **Agenda**, **Infos utiles**, **Services** |
| Devises | Consultation/config du convertisseur devises par hôtel (sélecteur d'hôtel, même module que côté hotel-admin) |
| Météo | Localités par hôtel (max 5), cache partagé par localité |
| Aéroports | Affectation/retrait d'aéroports par hôtel |
| Tokens API | Suivi et alerte de consommation des tokens FlightAPI |
| Journal d'activité | Historique filtrable de l'`audit_log` (par type d'entité, hôtel, utilisateur, date) |
| **Bornes kiosques** | Liste toutes les bornes (tous hôtels), statut temps réel (en ligne / hors ligne / désactivée), génération de clés d'inscription usage unique avec expiration configurable, copie de clé, toggle actif/inactif, suppression |
| Configuration hôtel | Page dédiée par hôtel (accessible depuis Hôtels → **Configurer**) — onglets : **Paramètres** (logo, fond, couleurs, messages, WiFi, check-in/out), **Sections** (activer/masquer les sections du kiosque), **Bon à savoir**, **Météo**, **Aéroports**, **Devises**, **Codes séjour** |
| **Sauvegarde & restauration** | Export/import d'archives `.zip` sur trois périmètres (un établissement, catalogue partagé, instance complète), essai à blanc avant écriture, instantanés conservés sur le serveur |

### Hotel-admin

| Page | Fonctionnalité |
|---|---|
| Tableau de bord | Notifications de workflow, compteurs de contenu |
| Paramètres hôtel | Logo, image de fond, thème couleurs, nom, contacts, WiFi, check-in/check-out, galerie carrousel (max 10 images), upload police personnalisée (`.ttf`/`.otf`) |
| Services et bien-être | Catégories propres + CRUD services |
| Bon à savoir | CRUD informations propres à l'hôtel — flag "notification" pour affichage clochette sur la borne |
| Agenda | CRUD événements propres (visibles hôtel uniquement) |
| Évaluations | Consultation des feedbacks kiosque — statistiques par catégorie, filtres date/note, export CSV et PDF |
| Devises | Devise de base, devises cibles (max 10), tableau des taux affiché sur la borne (max 5), MAJ auto (intervalle ou heures fixes) ou manuelle, refresh forcé |
| **Bornes kiosques** | Vue des bornes de l'hôtel avec statut temps réel, toggle actif/inactif |
| **Codes d'accès client** | Création (à l'unité ou en lot) des codes de séjour remis aux clients, fiche imprimable QR + code, suivi des appareils rattachés, révocation |
| **Sauvegarde & restauration** | Export/import de la configuration et du contenu de son établissement (réservé à `hotel_admin`, inaccessible au staff) |

### Contributeur

| Page | Fonctionnalité |
|---|---|
| Tableau de bord | Statut de mes soumissions (pending / pre_approved / published / rejected) |
| Mes lieux | Soumettre/modifier ses lieux (si can_submit_places) |
| Mes événements | Soumettre/modifier ses événements (si can_submit_events) |
| Mes infos utiles | Soumettre/modifier ses fiches (si can_submit_info) |

**Sécurité :** Authentification JWT (8h) transmis via **cookie HttpOnly `admin_token`** (`Secure` en prod, `SameSite=Strict`) — jamais exposé au JavaScript ni stocké en sessionStorage. Le sessionStorage ne conserve que des métadonnées non-sensibles (rôle, hôtel, email) pour l'UI. Requêtes admin en `withCredentials: true`. Route guards par rôle sur toutes les pages protégées.

---

## Vols — Planification par aéroport

Chaque aéroport possède sa propre règle de rafraîchissement, configurable en backoffice :

| Mode | Description | Exemple |
|---|---|---|
| Intervalle | Rafraîchissement toutes les N minutes | toutes les 5 min |
| Heures fixes | Rafraîchissement à des heures précises de la journée | 06h, 12h, 18h |
| Désactivé | Manuel uniquement via le bouton "Forcer le rafraîchissement" | — |

Le cache Redis est partagé par aéroport : si plusieurs hôtels affichent OUA, un seul appel FlightAPI.io est effectué.

---

## Météo — Cache partagé

Le cache météo est partagé par localité (TTL 30 min). Si les hôtels A, B et C affichent tous Ouagadougou, un seul appel OpenWeatherMap est effectué pour la ville. Chaque hôtel peut configurer jusqu'à **5 localités** à afficher sur la borne.

---

## Agenda — Règles d'archivage

| Type | Archivage |
|---|---|
| Événement daté passé | Automatique à J+1 après la date de fin |
| Événement non daté | Manuel uniquement |
| Événement récurrent | Manuel uniquement |

---

## Audit trail

Toutes les actions (création, modification, suppression, validation, rejet) sont enregistrées dans la table `audit_log` avec : utilisateur, action, entité, ancienne valeur, nouvelle valeur, date.

---

## Multilingue — ajouter une langue

1. Créer `frontend/src/i18n/xx.json` (copier `en.json` comme base)
2. Ajouter une entrée dans `frontend/src/i18n/locales.json` :
   ```json
   "xx": { "nativeName": "Nom natif", "dir": "ltr" }
   ```
3. C'est tout. La langue apparaît automatiquement dans le sélecteur (affichage par nom natif, sans drapeau).

> Pour les langues RTL (ex. arabe), mettre `"dir": "rtl"` — le sens d'écriture est appliqué automatiquement sur `<html dir="...">`.

---

## Carte & Points d'intérêt

- Fond de carte **CartoDB** — clé `VITE_CARTO_API_KEY` recommandée (gratuite sur carto.com) : sans elle, la tuile affiche "API KEY REQUIRED"
- Marqueurs par catégorie avec bulle de détail positionnée près du point cliqué
- La bulle suit le déplacement/zoom de la carte
- Galerie d'images scrollable dans la bulle (max 3 images par POI, gérées depuis le backoffice)
- Upload d'images via `POST /api/admin/poi/:id/images` → stocké dans `uploads/poi/`
- Les lieux sont gérés centralement par le super-admin et affectés aux hôtels

---

## Variables d'environnement

| Variable                  | Description                                   | Obligatoire      |
|---------------------------|-----------------------------------------------|------------------|
| `DB_ROOT_PASSWORD`        | Mot de passe root MySQL                       | Oui              |
| `DB_PASSWORD`             | Mot de passe utilisateur MySQL                | Oui              |
| `JWT_SECRET`              | Secret de signature JWT (32 car. min.)        | Oui — le serveur refuse de démarrer sans (fail-fast) |
| `ADMIN_PASSWORD`          | Mot de passe initial du super-admin (appliqué une seule fois, au 1er démarrage) | Non (connectbe2026) |
| `OPENWEATHERMAP_API_KEY`  | Clé OpenWeatherMap (météo)                    | Non (mock)       |
| `FLIGHTAPI_KEY`           | Clé FlightAPI.io (vols temps réel)            | Non (mock)       |
| `ORS_API_KEY`             | Clé OpenRouteService (itinéraires carte, proxifiée côté backend via `/api/directions`) | Non |
| `VITE_CARTO_API_KEY`      | Clé CartoDB (fond de carte) — sans clé, tuile affiche "API KEY REQUIRED" | Recommandé |
| `HOTEL_NAME`              | Nom de l'hôtel par défaut                     | Non (ConnectBé)  |
| `HOTEL_LAT` / `HOTEL_LNG` | Coordonnées GPS par défaut (héritage v1)     | Non (Ouaga)      |
| `HOTEL_CITY_OWM_ID`       | ID OpenWeatherMap de la ville (héritage v1)   | Non (Ouaga)      |
| `HOTEL_AIRPORT_IATA`      | Code IATA aéroport par défaut (héritage v1)   | Non (OUA)        |
| `IDLE_TIMEOUT_MS`         | Délai inactivité avant retour accueil (ms)    | Non (60000)      |
| `QR_TOKEN_TTL_MIN`        | Durée de vie des tokens QR (minutes)          | Non (10)         |
| `CORS_ORIGINS`            | Origines autorisées à appeler l'API, séparées par des virgules | Non (`http://localhost:3000,http://localhost:5173`) |
| `API_EXTERNAL_ORIGINS`    | Origines externes ajoutées à `connect-src` de la CSP (séparées par des virgules) | Non |
| `TRUST_PROXY`             | À définir dès qu'nginx ou Cloudflare est devant le backend — sans elle, `req.ip` vaut l'adresse du proxy pour tous les clients | Recommandé en prod |
| `GUEST_GRACE_HOURS`       | Marge de courtoisie après l'heure de départ, proposée à la création d'un code (heures) | Non (24) |
| `GUEST_RETENTION_DAYS`    | Délai avant purge RGPD des sessions et du nom du client (jours après la fin d'accès) | Non (30) |
| `GUEST_FAILURE_BUDGET`    | Échecs de saisie de code tolérés par minute et par client (anti-force brute) | Non (20) |
| `CONTENT_AUTH_ENFORCE`    | `true` verrouille les routes de contenu (jeton borne/visiteur/QR exigé) ; `false` = mode observation journalisé — [ordre de bascule](#mise-en-service-du-verrouillage--dans-cet-ordre) | Non (false) |
| `UPLOADS_DIR`             | Emplacement des fichiers uploadés | Non (`/uploads`) |
| `CONFIG_BACKUP_DIR`       | Emplacement des instantanés du module Sauvegarde & restauration | Non (`/backups/config`) |
| `LIBRETRANSLATE_URL`      | URL du service de traduction auto-hébergé | Non (`http://libretranslate:5000`) |

### Accès depuis un autre appareil (test mobile / kiosque)

Le navigateur envoie comme origine l'adresse tapée dans la barre d'URL. En ouvrant le front
depuis un téléphone sur `http://192.168.x.x:5173`, l'origine n'est plus `localhost` et le backend
répond `CORS: origine non autorisée`.

- **En développement** (`NODE_ENV` ≠ `production`), les origines en IP privée
  (`localhost`, `127.0.0.1`, `10.x`, `172.16–31.x`, `192.168.x`) sont acceptées automatiquement :
  rien à configurer, même si l'IP DHCP de la machine change.
- **En production**, seule la liste `CORS_ORIGINS` est acceptée — y renseigner le domaine public :

  ```bash
  CORS_ORIGINS=https://kiosque.monhotel.com,https://admin.monhotel.com
  ```

Après modification du `.env`, redémarrer le backend pour recharger les variables :

```bash
docker compose restart backend
```

---

## Mode offline

L'application est **offline-first** :
- Le **Service Worker** (`public/sw.js`) met en cache les assets statiques
- Au chargement de la borne, un **préchargement automatique** (`services/cacheWarmup.js`) interroge en arrière-plan tous les endpoints kiosque (météo, vols, devises, agenda, infos, POI, services, bon à savoir) — dans toutes les langues supportées — pour alimenter le cache avant toute interaction utilisateur
- L'**intercepteur Axios** lit le `localStorage` si le réseau est coupé
- Le **backend** retourne des données mock si une API externe est indisponible
- Une **bannière orange** s'affiche en cas de perte de connexion

---

## Versionner les données et déployer

Deux choses circulent, et elles ne se traitent pas de la même façon.

| | Circule par | Touche les contenus ? |
|---|---|---|
| **Code et schéma** | `git pull` + redémarrage du backend | Non |
| **Contenus** | La production elle-même, via le backoffice | — |

### Mettre à jour une production en service

```bash
cd /opt/connectbe
./scripts/db-backup.sh                              # filet de sécurité — toujours en premier
git pull
docker compose restart backend                      # runMigrations applique le schéma
docker compose up -d --build --no-deps frontend     # recompile le build servi par nginx
```

`mysql_data` est un volume nommé, jamais recréé : **les données saisies par le client ne sont
pas touchées**.

`backend/src` est monté depuis le dépôt : un `git pull` + `restart` suffit à livrer le code
serveur. Le **frontend, lui, est compilé dans l'image** (`vite build` → nginx) : toute
modification de `frontend/` — code, `public/`, ou une variable `VITE_*` du `.env` — exige un
`--build`. C'est le prix du passage en production : plus de serveur de développement exposé,
mais plus de rechargement à chaud non plus.

> ⚠️ **Si le `git pull` a modifié `backend/package.json`**, un `restart` ne suffit plus : la
> nouvelle dépendance n'est pas dans l'image, et le backend démarrera sur un
> `Cannot find module`. Il faut alors reconstruire :
>
> ```bash
> docker compose up -d --build --renew-anon-volumes --no-deps backend
> ```
>
> `--renew-anon-volumes` est indispensable — `/app/node_modules` est un volume **anonyme** qui
> survit à la recréation du conteneur et masquerait la dépendance fraîchement installée.
> `--no-deps` évite d'entraîner MySQL dans l'opération. Voir
> [QUICKSTART — dépendances npm](QUICKSTART.md#mode-a--docker-complet-le-plus-simple).

> ⚠️ **Ne jamais employer `--force-recreate` sans `--no-deps`.** `backend` dépend de `mysql` et
> `frontend` dépend de `backend` : la recréation se propage, et celle du conteneur MySQL peut
> échouer sur un conflit de nom en laissant la pile à l'arrêt. Les données survivent
> (`mysql_data` est un volume nommé), mais le service tombe — inacceptable sur une borne en
> exploitation.

> ⚠️ **Ne jamais rejouer `data_live.sql` sur une production en service.** C'est un
> `REPLACE INTO` global : il écrase toute ligne de même identifiant par votre version locale,
> sans distinguer vos modifications des saisies du client. Ce fichier sert à **amorcer** un
> déploiement, pas à le mettre à jour.

### Les trois mécanismes de sauvegarde — ne pas les confondre

| Mécanisme | Produit | Contenu | Versionné | Sert à |
|---|---|---|---|---|
| `scripts/db-backup.sh` | `backups/connectbe_<date>.sql.gz` | **Tout** — schéma, contenus, logs, analytics, avis, bornes | Non (`.gitignore`) | Reprise après sinistre serveur |
| `scripts/db-export.sh` | `database/seeds/data_live.sql` | Contenu éditorial seul | Oui | Amorcer un serveur vierge (une seule fois) |
| **Back-office → Sauvegarde & restauration** | `connectbe_<périmètre>_<date>.zip` | Configuration, contenu, traductions et médias | Non | Le client sauvegarde son travail, duplique un établissement, migre entre installations |

Le module du back-office n'est pas un dump SQL : il exporte des lignes logiques et reconstruit
les identifiants à l'import. C'est ce qui lui permet, contrairement à un `mysqldump`, de
restaurer sur une autre installation ou de recopier un établissement vers un autre sans
écraser l'hôtel n°1 existant ni casser les clés étrangères. Détail plus bas.

`db-export.sh` écarte volontairement ce qui est propre à une instance ou purement technique :
`audit_log`, `workflow_notifications`, `feedbacks`, `analytics_events`, `kiosks`, `kiosk_keys`,
`qr_tokens`, `guest_codes`, `guest_sessions`. Une borne enregistrée sur votre machine de dev n'a
rien à faire chez le client, et les codes de séjour d'un hôtel encore moins.

```bash
# Rapatrier l'état réel de la production dans git (à lancer SUR le serveur)
./scripts/db-export.sh
git add database/seeds/data_live.sql
git commit -m "chore: export données $(date +%Y-%m-%d)"
git push
```

Tant que la production n'est pas lancée, exporter depuis la machine de dev a du sens : c'est
ce qui amorcera le premier déploiement. **Dès qu'un client saisit ses propres données, le sens
s'inverse** — la production devient la source de vérité, et `data_live.sql` n'est plus qu'une
sauvegarde éditoriale versionnée.

### Frontend : basculer entre production et développement

Le frontend a deux modes, et le choix n'est pas cosmétique.

| | Production (défaut) | Développement |
|---|---|---|
| Cible du `Dockerfile` | `prod` | `dev` |
| Ce qui tourne | nginx servant `dist/` | serveur Vite |
| Compilation | `npm run build` à chaque fois (~1 min) | aucune |
| Code source | copié dans l'image | monté depuis le dépôt |
| Modifier un fichier | exige un nouveau `--build` | rechargement à chaud immédiat |
| Port conteneur | `5173:80` | `5173:5173` |
| Proxy API | nginx → backend | Vite, via `VITE_API_PROXY` |
| Variables `VITE_*` | figées à la compilation (build args) | lues à l'exécution |

L'URL reste `http://localhost:5173` dans les deux cas : seul le port interne change.

```bash
# Production — reconstruit l'artefact réellement livré
docker compose up -d --build --no-deps frontend

# Développement — serveur Vite, rechargement à chaud
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-deps frontend
```

**Recommandation.** Travailler une page en mode développement, puis repasser en production
**avant de committer** pour vérifier que le vrai bundle nginx la sert correctement. Compiler
n'est pas s'afficher : `vite build` valide la syntaxe et les imports, pas la mise en page.
C'est aussi l'état dans lequel il faut laisser l'installation — le mode production est le
défaut, délibérément.

> Le mode développement est **collant** : une fois le conteneur recréé avec la surcouche, il
> reste sur Vite jusqu'à ce qu'on le recrée avec le fichier de base seul. C'est précisément
> pourquoi la surcouche ne s'appelle pas `docker-compose.override.yml` : un override est chargé
> automatiquement, et s'il traînait sur le VPS la production repartirait sur le serveur de
> développement.

### Livrer du contenu préparé en dev

Si vous avez préparé du contenu en local (un jeu d'infos utiles, un catalogue de services) et
qu'il doit rejoindre une production déjà vivante, passez par un fichier de seed ciblé sur les
tables et les lignes concernées — comme `database/seeds/useful_info_burkina_faso.sql`. Jamais
par le dump global.

### Premier démarrage sur un nouveau serveur

`docker compose up --build` joue trois fichiers via `docker-entrypoint-initdb.d`, une seule
fois, sur un volume `mysql_data` vierge :

| Ordre | Fichier | Contenu |
|-------|---------|---------|
| 01 | `database/init.sql` | Schéma complet — structure seule, aucun `DROP`, rejouable |
| 02 | `database/seeds/bootstrap.sql` | Hôtel #1, super-admin, catégories, thème, aéroports |
| 03 | `database/seeds/data_live.sql` | Données réelles exportées, en `REPLACE INTO` |

Deux modes de déploiement, décidés **avant le premier démarrage** :

- **Avec les données** (défaut) — rien à faire, `data_live.sql` est chargé.
- **Base vierge** — commenter la ligne `03_data_live.sql` dans `docker-compose.yml`.
  Résultat : un hôtel, un compte super-admin, les catégories, zéro contenu métier.

Le mot de passe du super-admin (`admin@iconnectbe.com`) est initialisé au démarrage du backend
depuis la variable `ADMIN_PASSWORD` du `.env` — `bootstrap.sql` ne pose qu'un hash placeholder.

Les évolutions de schéma postérieures sont appliquées automatiquement au démarrage du backend
par `backend/src/services/runMigrations.js` (migrations idempotentes).

> **Clés API** — le fichier `.env` ne doit jamais être commité. Le transférer manuellement :
> ```bash
> scp .env user@serveur:/opt/connectbe/.env
> ```

---

## Sauvegarde & restauration de la configuration (back-office)

Permet au client de sauvegarder son travail et de le rétablir lui-même, sans accès SSH.
Pages : `/admin/hotel/backup` (son établissement) et `/admin/super/backup` (tous les périmètres).
Code : `backend/src/services/configBackup/` et `frontend/src/admin/pages/BackupManager.jsx`.

### Périmètres

| Périmètre | Rôle | Contenu |
|---|---|---|
| `hotel` | `hotel_admin`, `super_admin` | Paramètres et identité visuelle, devises, bon à savoir, messages défilants, services et leurs catégories, lieux/agenda/infos affichés, localités météo, aéroports suivis, médias |
| `global` | `super_admin` | Catalogue partagé : lieux, agenda, infos utiles, catégories globales, localités météo, **aéroports et leur planification de rafraîchissement des vols**, thème global |
| `full` | `super_admin` | `global` + tous les établissements |

`hotel_staff` n'y a pas accès : remplacer la configuration d'un établissement n'est pas une
opération de saisie courante.

### Ce qui n'est jamais exporté

Comptes et mots de passe (`admin_users`), jetons d'appareils (`kiosks`, `kiosk_keys`,
`qr_tokens`), codes de séjour et sessions visiteurs (`guest_codes`, `guest_sessions` —
données personnelles), quotas d'API, journal d'audit, statistiques d'usage, avis clients
(données personnelles), cache météo. La clé d'API du fournisseur de taux de change
(`devise_config.api_key`) est retirée de l'archive : l'import conserve celle déjà en place.

### Contenu d'une archive

```
connectbe_<périmètre>_<date>.zip
├── manifest.json   périmètre, date, auteur, identifiant d'instance, décompte par table,
│                   colonnes exportées, champs retirés
├── data.json       les lignes, par table
└── uploads/…       logos, fonds, polices, bannières, photos de lieux et d'événements
```

`manifest.json` porte un numéro de format : une archive produite par une version plus récente
de l'application est refusée plutôt que d'être appliquée de travers. À l'import, les colonnes
de l'archive sont comparées au schéma réel, ce qui laisse passer une dérive (colonne ajoutée
ou retirée depuis l'export) en la signalant au lieu d'échouer.

### Import

Rien n'est écrit avant confirmation : le fichier est d'abord analysé côté serveur et
l'utilisateur voit le décompte par type de contenu, la correspondance des établissements et
les avertissements. Deux modes :

- **Fusionner** — les fiches de l'archive écrasent leurs homologues, le reste est conservé.
  L'opération est neutre si on la rejoue : les lignes sont retrouvées par clé fonctionnelle
  (slug d'un événement, intitulé français d'une info utile, coordonnées d'un lieu…), pas par
  identifiant.
- **Remplacer** — vide le périmètre restauré avant d'insérer.

Un **instantané de sécurité** est créé juste avant toute écriture, et l'import est refusé si
cet instantané échoue. Les 20 derniers instantanés sont conservés dans `backups/config/` et
listés dans la page, avec restauration et téléchargement.

### Deux garde-fous qui méritent d'être connus

**Le contenu partagé n'est jamais vidé** (hors périmètre `full`), même en mode remplacement :
les lieux, l'agenda, les infos utiles, les aéroports et les localités sont rattachés à
plusieurs établissements. Les effacer pour en restaurer un seul supprimerait les rattachements
des autres par cascade — ou échouerait sur une contrainte `RESTRICT`. Ces lignes sont mises à
jour, et le rapport le dit.

**La paternité du contenu ne suit pas la copie.** `events.owner_hotel_id` et
`useful_contacts.owner_hotel_id` disent qui a soumis la fiche, pas où elle s'affiche. Dupliquer
la configuration d'un hôtel vers un autre le rattache au contenu partagé sans lui en attribuer
la paternité.

### Médias

Sur la même installation, les fichiers sont laissés à leur place — y compris pour une
duplication vers un autre établissement, où les réécrire ne ferait que dupliquer les photos
des lieux partagés. Pour une archive venue d'une **autre** installation, les médias sont rangés
dans `uploads/restored/<date>/` et les chemins en base réécrits : un fichier de même nom y
appartient à quelqu'un d'autre, l'écraser détruirait une image en service.

Les chemins sont réputés relatifs à `/uploads` et `/backups` (volumes montés) ; `UPLOADS_DIR`
et `CONFIG_BACKUP_DIR` permettent de les déplacer. Toute entrée d'archive qui tenterait de
sortir de `uploads/` est refusée.

---

## Volumes Docker importants

```yaml
# Base de données — données persistées entre redémarrages
mysql_data:/var/lib/mysql

# Backend — persistence des fichiers uploadés (logos, images POI, polices)
./uploads:/uploads

# Backend — instantanés de configuration créés par le back-office
./backups:/backups

# Frontend — hot-reload du code source sans rebuild
./frontend/src:/app/src
```

> Si les images uploadées disparaissent après un rebuild, vérifier que le dossier `uploads/` existe sur l'hôte et est bien monté.

---

## Identification et monitoring des bornes

### Flux d'inscription (une seule fois par borne)

```
Super-admin génère une clé → liée à un hôtel + expiration (72h par défaut)
    ↓
Technicien saisit la clé sur l'écran d'inscription de la borne
    ↓
POST /api/kiosk-device/register { key, fingerprint, hotel_slug }
    ↓
Backend valide : clé existante, non utilisée, non expirée, bon hôtel
    ↓
Borne reçoit un device_token → stocké en localStorage (clé par hôtel)
    ↓
Interface publique s'affiche
```

### Flux normal (chaque démarrage)

```
Borne démarre → lit device_token depuis localStorage
    ↓
POST /api/kiosk-device/auth { device_token }
    ↓
Si token invalide → écran d'inscription
Si enabled=false  → écran "Borne désactivée"
Si enabled=true   → interface publique + heartbeat toutes les 5 min
```

### Heartbeat et monitoring

- `PUT /api/kiosk-device/heartbeat` toutes les **5 minutes** (authentifié par device_token)
- La réponse contient `enabled` — si `false`, l'interface se met en écran désactivé en temps réel
- Le backend (KioskMonitor) vérifie toutes les 5 min les bornes sans heartbeat depuis **> 10 minutes**
- Si une borne est détectée hors ligne, une **notification backoffice** est envoyée au super-admin et à l'hotel-admin concerné (via `workflow_notifications`)
- La notification n'est envoyée qu'une seule fois par incident — elle se réinitialise au prochain heartbeat

### Mode test (bypass)

Pour tester l'interface sans borne physique enregistrée, ajouter `?bypass=1` à l'URL :

```
https://votre-domaine.com/<hotel-slug>?bypass=1
```

Aucune clé n'est demandée. Ce mode est destiné au développement uniquement.

### Sécurité

- La clé est à **usage unique** — marquée utilisée dès la première inscription
- La clé est **liée à un hôtel** — elle est rejetée si présentée sur l'URL d'un autre hôtel
- Tous les cas d'échec d'inscription retournent le même message générique (`Clé invalide`) pour éviter toute fuite d'information
- Le device_token est stocké **par hôtel** dans localStorage (`connectbe_device_token_<slug>`) — un token enregistré pour l'hôtel A ne permet pas d'accéder à l'hôtel B

### Tables DB

| Table | Rôle |
|---|---|
| `kiosks` | Bornes enregistrées (device_token, fingerprint, label, is_enabled, last_seen_at) |
| `kiosk_keys` | Clés d'inscription générées (key_value, hotel_id, expires_at, used_at) |

---

## Accès client par code de séjour

Le client retrouve **tout le menu de la borne sur son propre téléphone**, pendant la durée de
son séjour, sans installer d'application et sans compte. La réception lui remet un code court
à l'enregistrement.

URL publique : `https://votre-domaine.com/<slug-hôtel>/visiteur` — le QR de la fiche imprimée
porte directement le code (`?c=K7F2QM`), le client n'a donc rien à saisir.

### Flux

```
Réception crée un code (à l'unité ou en lot) → fiche imprimable A5 : QR + code + URL
    ↓
Le client scanne le QR (ou saisit le code sur /<slug>/visiteur)
    ↓
POST /api/guest/redeem { hotel_slug, code, fingerprint }
    ↓
Backend vérifie la fenêtre [début, fin + marge de courtoisie] et le quota d'appareils
    ↓
guest_token (JWT expirant à la fin d'accès réelle) → tout le menu s'affiche
    ↓
Séjour terminé → écran de remerciement, pas un message d'erreur
```

Un rechargement de page depuis le même appareil **réutilise** sa session au lieu de consommer
un second appareil du quota (index unique `(code_id, fingerprint)`).

### Paramètres d'un code

| Champ | Rôle |
|---|---|
| `code` | 6 caractères base32 Crockford, sans caractères ambigus (ni `O`/`0`, ni `I`/`1`/`L`) — unique par hôtel |
| `room_number`, `guest_name` | Repères pour la réception ; le nom sert la bienvenue nominative |
| `occupants` → `max_devices` | Nombre d'appareils autorisés, **plancher à 2** (un client seul a souvent téléphone + tablette) |
| `valid_from` / `valid_until` | Fenêtre de séjour |
| `grace_hours` | Marge après le départ (24 h par défaut, `GUEST_GRACE_HOURS`) |
| `revoked_at` | Révocation immédiate depuis le back-office |

Statuts affichés en back-office : **à venir**, **actif**, **courtoisie**, **expiré**, **révoqué**.

### Ce que voit le client — et lui seul

`GET /api/guest/me` (jeton requis) renvoie le **mot de passe Wi-Fi**, l'heure de départ et la
bienvenue nominative. Ces informations ne partent plus dans la configuration publique du
kiosque : `wifi_password` et `fullscreen_password` en ont été retirés.

`POST /api/guest/qr`, qui alimente le QR affiché à la borne ou à la réception, valide le code
**sans créer de session** — la borne n'entame pas le quota du client — et ne renvoie aucune
donnée nominative : l'écran est visible de tout le hall.

### Sécurité

- **Le jeton n'est jamais stocké en clair** : la base ne garde que son SHA-256, qui sert de clé
  de révocation. Un vol de base ne donne pas accès aux séjours en cours.
- **Budget d'échecs** (`GUEST_FAILURE_BUDGET`, 20/min) plutôt qu'un limiteur de débit
  classique : seules les saisies **fausses** le consomment, un code valide est toujours servi.
  Face à ~729 millions de combinaisons, l'essai exhaustif est hors de portée.
- **Verrouillage des routes de contenu** (`contentAuth`) : météo, vols, lieux, services… exigent
  un porteur — jeton visiteur, jeton de borne ou jeton de QR mobile — et un jeton d'un hôtel ne
  lit pas les données d'un autre. Voir la mise en service ci-dessous.
- **Purge RGPD automatique** : `GUEST_RETENTION_DAYS` jours (30 par défaut) après la fin
  d'accès, les appareils rattachés sont supprimés et le nom du client effacé
  (`anonymized_at`). Les statistiques d'usage par chambre survivent, l'identité non.
- **Hors de toute sauvegarde transportable** : `guest_codes` et `guest_sessions` sont exclues
  du seed `data_live.sql` comme des archives du back-office. Un code de séjour est propre à une
  installation et à un moment ; le dupliquer ailleurs transporterait des données personnelles et
  pourrait ressusciter un code révoqué. Seul `scripts/db-backup.sh` les conserve — c'est son rôle.

### Mise en service du verrouillage — dans cet ordre

`CONTENT_AUTH_ENFORCE` gouverne la garde des routes de contenu, qui étaient jusqu'ici
entièrement publiques :

1. **`false` (défaut) — mode observation.** Les appels sans jeton passent mais sont journalisés.
   Déployer d'abord ainsi et vérifier dans les journaux qu'aucun appel légitime ne tombe.
2. **Recharger le front sur toutes les bornes en service** — une borne restée sur l'ancien
   bundle n'envoie pas son jeton.
3. **`true` — verrouillé.** Basculer seulement ensuite.

Basculer avant que les bornes aient rechargé leur front les laisse écran blanc.

### Tables DB

| Table | Rôle |
|---|---|
| `guest_codes` | Codes de séjour (code, chambre, nom, occupants, max_devices, fenêtre, grace_hours, revoked_at, anonymized_at) |
| `guest_sessions` | Appareils rattachés à un code (token_hash SHA-256, fingerprint, user-agent, IP, first/last_seen_at, revoked_at) |

---

## Mode kiosque (borne physique)

### Autostart au démarrage — Linux / systemd

Créer `/etc/systemd/system/connectbe-kiosk.service` :

```ini
[Unit]
Description=ConnectBé Kiosk
After=network.target docker.service

[Service]
Type=simple
User=kiosk
WorkingDirectory=/opt/connectbe
ExecStart=/usr/bin/docker compose up
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable connectbe-kiosk
sudo systemctl start connectbe-kiosk
```

---

## Workflow Git

```bash
# Travailler sur la migration multi-hôtels
git checkout feat/multi-hotel

# Revenir à la version mono-hôtel stable
git checkout main

# Revenir à la version figée de sauvegarde
git checkout backup/single-hotel-v1
```

```bash
# Pousser ses modifications
git add fichier1 fichier2
git commit -m "feat: description de ce que tu as fait"
git push origin feat/multi-hotel
```

> **En cas d'erreur "Author identity unknown"** (première utilisation) :
> ```bash
> git config --global user.email "akientega@icloud.com"
> git config --global user.name "v2vz5fj7qj-droid"
> ```

---

## État d'avancement

### Version 1 — Mono-hôtel (`backup/single-hotel-v1`)

| Section                  | Statut      |
|--------------------------|-------------|
| Menu d'accueil           | ✅ Complet  |
| Météo                    | ✅ Complet  |
| Vols                     | ✅ Complet  |
| Services                 | ✅ Complet  |
| Agenda événements        | ✅ Complet  |
| Carte & POI (Leaflet)    | ✅ Complet  |
| Infos utiles             | ✅ Complet  |
| Transfert mobile         | ✅ Complet  |
| Multilingue 9 langues    | ✅ Complet  |
| Mode offline             | ✅ Complet  |
| Analytics                | ✅ Complet  |
| Backoffice admin         | ✅ Complet  |
| Mode nuit auto           | ✅ Complet  |
| Animations transitions   | ✅ Complet  |
| Cache vols               | ✅ Complet  |
| Galerie images POI       | ✅ Complet  |
| QR code avec token TTL   | ✅ Complet  |
| MobileGate (page mobile) | ✅ Complet  |
| Plein écran protégé      | ✅ Complet  |

### Version 2 — Multi-hôtels (`feat/multi-hotel`)

| Module                                          | Statut      |
|-------------------------------------------------|-------------|
| Migration DB multi-hôtels                       | ✅ Complet  |
| Rôles et authentification JWT                   | ✅ Complet  |
| Super-admin backoffice                          | ✅ Complet  |
| Hotel-admin backoffice                          | ✅ Complet  |
| Contributor backoffice                          | ✅ Complet  |
| Workflow validation (pending → published/rejet) | ✅ Complet  |
| Modal détail soumissions (Lieux/Événements/Infos) | ✅ Complet |
| Rejet avec motif inline (sans fermer la modal)  | ✅ Complet  |
| Page configuration hôtel (Paramètres)           | ✅ Complet  |
| Configuration météo par hôtel (onglet dédié)    | ✅ Complet  |
| Configuration aéroports par hôtel (onglet dédié)| ✅ Complet  |
| Cache partagé vols (par aéroport)               | ✅ Complet  |
| Cache partagé météo (par localité)              | ✅ Complet  |
| Planification vols par aéroport                 | ✅ Complet  |
| Suivi tokens FlightAPI                          | ✅ Complet  |
| Services et bien-être (multi)                   | ✅ Complet  |
| Bon à savoir (par hôtel)                        | ✅ Complet  |
| Audit trail                                     | ✅ Complet  |
| Notifications dashboard workflow                | ✅ Complet  |
| Archivage automatique agenda                    | ✅ Complet  |
| Images bannière carrousel par hôtel (max 10)    | ✅ Complet  |
| Traduction automatique LibreTranslate           | ✅ Complet  |
| Feedback kiosque (notation + commentaire)       | ✅ Complet  |
| FeedbackManager backoffice (stats + export)     | ✅ Complet  |
| Police personnalisée par hôtel (upload TTF/OTF) | ✅ Complet  |
| Convertisseur de devises (borne + backoffice)   | ✅ Complet  |
| Bon à savoir — flag is_notification (clochette) | ✅ Complet  |
| Identification et inscription des bornes        | ✅ Complet  |
| Monitoring heartbeat (5 min)                    | ✅ Complet  |
| Alertes backoffice borne hors ligne             | ✅ Complet  |
| Gestion bornes super-admin (clés, toggle, suppression) | ✅ Complet |
| Gestion bornes hotel-admin (vue + toggle)       | ✅ Complet  |
| Sauvegarde & restauration back-office (.zip)    | ✅ Complet  |
| Barre de section unique (SectionChrome)         | ✅ Complet  |
| Sections activables par hôtel                   | ✅ Complet  |
| Accès client par code de séjour (espace visiteur) | ✅ Complet |
| Codes séjour back-office (création, lot, QR, révocation) | ✅ Complet |
| Purge RGPD des sessions visiteurs               | ✅ Complet  |
| Verrouillage des routes de contenu (contentAuth) | ⚠️ Livré en mode observation — bascule `CONTENT_AUTH_ENFORCE=true` après rechargement des bornes |
