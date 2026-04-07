# ConnectBé — Borne Interactive Hôtel

Concierge numérique tactile pour hôtel — Ouagadougou, Burkina Faso.

> Pour le démarrage rapide, voir [QUICKSTART.md](QUICKSTART.md).

---

## Architecture

```
HotelInteractivescreen/
├── frontend/          React 18 + Vite 6 (borne kiosque + backoffice admin)
├── backend/           Node.js / Express (API REST)
├── database/          Schéma MySQL + seeds
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

---

## Stack technique

| Couche    | Technologies                                                       |
|-----------|--------------------------------------------------------------------|
| Frontend  | React 18, Vite 6, React Router 6, CSS Modules, Lucide              |
| Carte     | Leaflet 1.9 + react-leaflet 4.2, tuiles CartoDB Voyager (gratuit)  |
| Backend   | Node.js, Express, JWT (jsonwebtoken), multer                       |
| BDD       | MySQL 8, Redis (cache sans TTL), ioredis                           |
| Infra     | Docker Compose, Nginx (production)                                 |
| APIs      | OpenWeatherMap, FlightAPI.io                                       |

---

## Fonctionnalités de la borne

| Section          | Description                                                                |
|------------------|----------------------------------------------------------------------------|
| Menu d'accueil   | Dashboard 3 zones, horloge live, notifications rotatives toutes les 5s     |
| Météo            | Météo actuelle + prévisions 5 jours + alertes saisonnières (OWM)           |
| Vols             | Arrivées/départs OUA, recherche par numéro de vol, statut traduit           |
| Bien-être        | Services spa/massage/piscine (info + horaires + tarifs)                     |
| Agenda           | Événements à Ouagadougou, filtres par catégorie                            |
| Carte & POI      | Carte Leaflet interactive, bulle de détail avec galerie d'images (max 3)   |
| Infos utiles     | Contacts urgences, taxis, ambassades, pharmacies                           |
| Transfert mobile | QR code avec token TTL (10 min) pour continuer sur smartphone              |

**Fonctionnalités transversales :**
- Multilingue 8 langues : FR, EN, DE, ES, PT, AR (RTL), ZH, JA
- Sélecteur de langue dans la barre de navigation basse — dropdown vers le haut
- Architecture i18n extensible : ajouter une langue = 1 fichier JSON + 1 ligne dans `locales.json`
- Mode offline (Service Worker + cache localStorage)
- Cache vols sans expiration — auto-refresh toutes les 30 min, données conservées en cas de coupure réseau
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

Accessible sur `/admin` — interface séparée de la borne.

| Page             | Fonctionnalité                                                              |
|------------------|-----------------------------------------------------------------------------|
| Tableau de bord  | Compteurs de contenu + graphique d'interactions 7 jours                     |
| Bien-être        | CRUD services (nom, description FR/EN, image, horaires, prix)               |
| Agenda           | CRUD événements (catégorie, dates, lieu, mise en avant)                     |
| Bon à savoir     | Notifications rotatives sur la borne (FR + EN, ordre)                       |
| Carte & POI      | CRUD points d'intérêt (catégorie, GPS, téléphone, description, galerie 3 photos) |
| Infos utiles     | CRUD contacts (taxi, médecin, urgences, ambassade — FR/EN)                  |
| Localités météo  | Villes affichées dans la météo, localité par défaut                         |
| Vols             | Config aéroport IATA, scheduler auto 30 min, compteur crédits FlightAPI     |
| Thème            | Couleurs, logo (upload ou URL), nom hôtel, mot de passe plein écran — live sans redéploiement |

**Sécurité :** Authentification JWT (8h), token en sessionStorage, route guard sur toutes les pages protégées.

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

---

## Cache des vols

- Les données de vols sont stockées dans Redis **sans TTL** (pas d'expiration)
- Un scheduler automatique rafraîchit les données **toutes les 30 minutes**
- En cas d'indisponibilité réseau, les anciennes données restent affichées
- Un scheduler additionnel configurable depuis le backoffice peut s'y ajouter
- Les statuts bruts de l'API (ex. "En Route", "Landed") sont normalisés vers les clés i18n connues

---

## Variables d'environnement

| Variable                  | Description                                | Obligatoire      |
|---------------------------|--------------------------------------------|------------------|
| `DB_ROOT_PASSWORD`        | Mot de passe root MySQL                    | Oui              |
| `DB_PASSWORD`             | Mot de passe utilisateur MySQL             | Oui              |
| `OPENWEATHERMAP_API_KEY`  | Clé OpenWeatherMap (météo)                 | Non (mock)       |
| `FLIGHTAPI_KEY`           | Clé FlightAPI.io (vols temps réel)         | Non (mock)       |
| `HOTEL_AIRPORT_IATA`      | Code IATA aéroport par défaut (ex: OUA)    | Non (OUA)        |
| `ADMIN_USERNAME`          | Login backoffice (défaut : `admin`)        | Non              |
| `ADMIN_PASSWORD`          | Mot de passe backoffice                    | Non              |
| `JWT_SECRET`              | Secret de signature JWT                    | Non (défaut dev) |
| `HOTEL_LAT` / `HOTEL_LNG` | Coordonnées GPS de l'hôtel               | Non (Ouaga)      |
| `IDLE_TIMEOUT_MS`         | Délai inactivité avant retour accueil      | Non (30000)      |
| `QR_TOKEN_TTL_MIN`        | Durée de vie des tokens QR (minutes)       | Non (10)         |
| `VITE_ORS_API_KEY`        | Clé OpenRouteService (itinéraires carte)   | Non              |

---

## Endpoints API

```
GET  /api/health                              Santé du serveur
GET  /api/weather/current                     Météo actuelle + prévisions 5 jours
GET  /api/flights?type=arrivals&airport=OUA   Vols (arrivals|departures)
GET  /api/flights/search?flight=ET937         Recherche par numéro de vol
GET  /api/wellness?locale=fr                  Services bien-être
GET  /api/events?locale=fr&category=...       Agenda événements
GET  /api/poi?locale=fr&category=...          Points d'intérêt (avec images)
GET  /api/info?locale=fr                      Contacts utiles
GET  /api/notifications                       Notifications actives (borne)
GET  /api/theme                               Configuration thème
POST /api/theme/fullscreen-verify             Vérifier le mot de passe plein écran (public)
GET  /api/analytics/summary                   Stats interactions 24h
POST /api/analytics                           Enregistrer une interaction
POST /api/qr/token                            Générer un token QR signé avec TTL
GET  /api/qr/validate/:token                  Valider un token QR (→ 410 si expiré)

POST /api/admin/login                         Authentification admin
GET  /api/admin/wellness                      Liste services (admin)
POST /api/admin/wellness                      Créer service
PUT  /api/admin/wellness/:id                  Modifier service
DELETE /api/admin/wellness/:id                Supprimer service
[Idem pour /admin/events, /admin/notifications, /admin/info]

GET  /api/admin/poi                           Liste POI (admin, avec images)
POST /api/admin/poi                           Créer POI
PUT  /api/admin/poi/:id                       Modifier POI
DELETE /api/admin/poi/:id                     Supprimer POI
POST /api/admin/poi/:id/images                Uploader une image (max 3)
DELETE /api/admin/poi/images/:imageId         Supprimer une image

GET  /api/admin/theme                         Config thème (admin)
PUT  /api/admin/theme                         Modifier thème
POST /api/admin/theme/logo                    Upload logo

GET  /api/admin/analytics?days=7              Stats interactions (admin)
GET  /api/admin/flights/config                Config vols
PUT  /api/admin/flights/config                Modifier config + redémarrer scheduler
POST /api/admin/flights/refresh               Rafraîchissement manuel
GET  /api/admin/flights/credits               Crédits FlightAPI utilisés/restants
POST /api/admin/flights/credits/reset         Remettre le compteur à zéro
POST /api/admin/weather/refresh               Rafraîchissement météo manuel
```

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

## Personnaliser le thème sans redéploiement

```bash
curl -X PUT http://localhost:4001/api/admin/theme \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "updates": {
      "hotel_name":    "Mon Hôtel",
      "color_primary": "#1A6B3C"
    }
  }'
```

Ou directement depuis le backoffice → **Thème**.

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

## Workflow Git — Pousser ses modifications sur GitHub

```bash
# 1. Voir ce qui a changé
git status

# 2. Ajouter les fichiers modifiés
git add -A

# 3. Créer un commit avec un message descriptif
git commit -m "feat: description de ce que tu as fait"

# 4. Envoyer sur GitHub
git push origin main
```

> **En cas d'erreur "Author identity unknown"** (première utilisation) :
> ```bash
> git config --global user.email "akientega@icloud.com"
> git config --global user.name "v2vz5fj7qj-droid"
> ```
> Puis relance `git commit` et `git push`.

---

## Sections développées

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
| Multilingue 8 langues    | ✅ Complet  |
| Mode offline             | ✅ Complet  |
| Analytics                | ✅ Complet  |
| Backoffice admin         | ✅ Complet  |
| Mode nuit auto           | ✅ Complet  |
| Animations transitions   | ✅ Complet  |
| Cache vols sans expiration | ✅ Complet |
| Galerie images POI       | ✅ Complet  |
| QR code avec token TTL   | ✅ Complet  |
| MobileGate (page mobile) | ✅ Complet  |
| Plein écran protégé      | ✅ Complet  |
