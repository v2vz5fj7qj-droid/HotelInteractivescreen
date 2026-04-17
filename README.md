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
| Frontend (borne) | **5173**  | 5173         |
| Backend API      | **4001**  | 4000         |
| MySQL            | **3307**  | 3306         |
| Redis            | **6380**  | 6379         |
| LibreTranslate   | interne   | 5000         |

---

## Stack technique

| Couche    | Technologies                                                                    |
|-----------|---------------------------------------------------------------------------------|
| Frontend  | React 18, Vite 6, React Router 6, CSS Modules, Lucide                           |
| Carte     | Leaflet 1.9 + react-leaflet 4.2, tuiles CartoDB Voyager (gratuit)               |
| Backend   | Node.js, Express, JWT (jsonwebtoken), multer                                    |
| BDD       | MySQL 8, Redis (cache partagé inter-hôtels), ioredis                            |
| Traduction| LibreTranslate (auto-hébergé, 9 langues, aucune clé API requise)                |
| Infra     | Docker Compose, Nginx (production)                                              |
| APIs      | OpenWeatherMap, FlightAPI.io, OpenRouteService                                  |

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

| Section              | Description                                                                |
|----------------------|----------------------------------------------------------------------------|
| Menu d'accueil       | Dashboard 3 zones, horloge live, notifications rotatives toutes les 5s     |
| Météo                | Météo actuelle + prévisions 5 jours + alertes saisonnières (OWM)           |
| Vols                 | Arrivées/départs multi-aéroports par hôtel, recherche par numéro de vol    |
| Services et bien-être| Services spa/massage/piscine (info + horaires + tarifs)                    |
| Agenda               | Événements globaux + événements propres à l'hôtel, filtres par catégorie   |
| Carte & POI          | Carte Leaflet interactive, bulle de détail avec galerie d'images (max 3)   |
| Infos utiles         | Contacts urgences, taxis, ambassades, pharmacies                           |
| Bon à savoir         | Informations propres à l'hôtel (règles, équipements, horaires...)          |
| Transfert mobile     | QR code avec token TTL (10 min) pour continuer sur smartphone              |

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
- Badge météo flottant sur toutes les pages secondaires
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
| Configuration hôtel | Page dédiée par hôtel — 3 onglets : **Paramètres** (logo, fond, couleurs, messages, WiFi, check-in/out), **Météo** (localités, défaut, refresh), **Aéroports** (affectation/retrait) |
| Carte & POI | CRUD lieux, **modal détail** (coordonnées, carte OSM, contributeur, historique rejet) avant validation/rejet, affectation → hôtels |
| Agenda | CRUD événements globaux, **modal détail** (titre, description, dates, lieu, contributeur) avant validation/rejet/archivage |
| Infos utiles | CRUD, **modal détail** (contacts, description, contributeur) avant validation/rejet |
| Services (catégories globales) | Catégories modèles réutilisables par les hôtels |
| Météo | Localités par hôtel (max 5), cache partagé par localité |
| Vols | Clé API, aéroports par hôtel, planification par aéroport, suivi tokens |
| Users | CRUD comptes, rôles, permissions contributeurs |

### Hotel-admin

| Page | Fonctionnalité |
|---|---|
| Tableau de bord | Notifications de workflow, compteurs de contenu |
| Paramètres hôtel | Logo, image de fond, thème couleurs, nom, contacts, WiFi, check-in/check-out |
| Images de bannière | Galerie carrousel (max 10 images) affichée à l'accueil de la borne |
| Services et bien-être | Catégories propres + CRUD services |
| Bon à savoir | CRUD informations propres à l'hôtel |
| Agenda | CRUD événements propres (visibles hôtel uniquement) |

### Contributeur

| Page | Fonctionnalité |
|---|---|
| Tableau de bord | Statut de mes soumissions (pending / pre_approved / published / rejected) |
| Mes lieux | Soumettre/modifier ses lieux (si can_submit_places) |
| Mes événements | Soumettre/modifier ses événements (si can_submit_events) |
| Mes infos utiles | Soumettre/modifier ses fiches (si can_submit_info) |

**Sécurité :** Authentification JWT (8h), token en sessionStorage, route guards par rôle sur toutes les pages protégées.

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
   "xx": { "nativeName": "Nom natif", "flag": "🏳️", "dir": "ltr" }
   ```
3. C'est tout. La langue apparaît automatiquement dans le sélecteur.

> Pour les langues RTL (ex. arabe), mettre `"dir": "rtl"` — le sens d'écriture est appliqué automatiquement sur `<html dir="...">`.

---

## Carte & Points d'intérêt

- Fond de carte **CartoDB Voyager** (gratuit, aucune clé API requise)
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
| `JWT_SECRET`              | Secret de signature JWT (32 car. min.)        | Non (défaut dev) |
| `ADMIN_PASSWORD`          | Mot de passe du compte super-admin            | Non (connectbe2026) |
| `OPENWEATHERMAP_API_KEY`  | Clé OpenWeatherMap (météo)                    | Non (mock)       |
| `FLIGHTAPI_KEY`           | Clé FlightAPI.io (vols temps réel)            | Non (mock)       |
| `VITE_ORS_API_KEY`        | Clé OpenRouteService (itinéraires carte)      | Non              |
| `HOTEL_NAME`              | Nom de l'hôtel par défaut                     | Non (ConnectBé)  |
| `HOTEL_LAT` / `HOTEL_LNG` | Coordonnées GPS par défaut (héritage v1)     | Non (Ouaga)      |
| `HOTEL_CITY_OWM_ID`       | ID OpenWeatherMap de la ville (héritage v1)   | Non (Ouaga)      |
| `HOTEL_AIRPORT_IATA`      | Code IATA aéroport par défaut (héritage v1)   | Non (OUA)        |
| `IDLE_TIMEOUT_MS`         | Délai inactivité avant retour accueil (ms)    | Non (60000)      |
| `QR_TOKEN_TTL_MIN`        | Durée de vie des tokens QR (minutes)          | Non (10)         |

---

## Mode offline

L'application est **offline-first** :
- Le **Service Worker** (`public/sw.js`) met en cache les assets statiques
- L'**intercepteur Axios** lit le `localStorage` si le réseau est coupé
- Le **backend** retourne des données mock si une API externe est indisponible
- Une **bannière orange** s'affiche en cas de perte de connexion

---

## Volumes Docker importants

```yaml
# backend — persistence des fichiers uploadés
- ./uploads:/uploads

# frontend — hot-reload de la config Vite
- ./frontend/vite.config.js:/app/vite.config.js
```

> Si les images uploadées disparaissent après un rebuild, vérifier que le dossier `uploads/` existe sur l'hôte et est bien monté.

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
| Bien-être                | ✅ Complet  |
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
