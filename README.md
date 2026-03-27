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

| Couche    | Technologies                                              |
|-----------|-----------------------------------------------------------|
| Frontend  | React 18, Vite 6, React Router 6, CSS Modules, Lucide     |
| Backend   | Node.js, Express, JWT (jsonwebtoken), multer              |
| BDD       | MySQL 8, Redis (cache), ioredis                           |
| Infra     | Docker Compose, Nginx (production)                        |
| APIs      | OpenWeatherMap, FlightAPI.io                              |

---

## Fonctionnalités de la borne

| Section          | Description                                               |
|------------------|-----------------------------------------------------------|
| Menu d'accueil   | Dashboard 3 zones, horloge live, notifications rotatives toutes les 5s |
| Météo            | Météo actuelle + prévisions 7 jours (OWM)                 |
| Vols             | Arrivées/départs OUA, recherche par numéro de vol         |
| Bien-être        | Services spa/massage/piscine (info + horaires + tarifs)   |
| Agenda           | Événements à Ouagadougou, filtres par catégorie           |
| Carte & POI      | Carte Leaflet avec restaurants, pharmacies, taxis…        |
| Infos utiles     | Contacts urgences, taxis, ambassades, pharmacies          |
| Transfert mobile | QR code pour continuer sur smartphone                     |

**Fonctionnalités transversales :**
- Multilingue FR / EN
- Mode offline (Service Worker + cache localStorage)
- Mode nuit automatique (sombre 20h–7h, clair 7h–20h)
- Attract screen après 30s d'inactivité sur l'accueil
- Retour automatique à l'accueil après 30s d'inactivité sur toute autre page
- Animations de transition entre pages
- Badge météo flottant sur toutes les pages secondaires
- Raccourci admin caché : 5 taps sur le logo → `/admin`

---

## Backoffice admin

Accessible sur `/admin` — interface séparée de la borne.

| Page             | Fonctionnalité                                              |
|------------------|-------------------------------------------------------------|
| Tableau de bord  | Compteurs de contenu + graphique d'interactions 7 jours     |
| Bien-être        | CRUD services (nom, description FR/EN, image, horaires, prix)|
| Agenda           | CRUD événements (catégorie, dates, lieu, mise en avant)     |
| Bon à savoir     | Notifications rotatives sur la borne (FR + EN, ordre)       |
| Carte & POI      | CRUD points d'intérêt (catégorie, GPS, téléphone, statut)   |
| Infos utiles     | CRUD contacts (taxi, médecin, urgences, ambassade — FR/EN)  |
| Localités météo  | Villes affichées dans la météo, localité par défaut         |
| Vols             | Config aéroport IATA, intervalle de rafraîchissement, scheduler auto, compteur crédits FlightAPI |
| Thème            | Couleurs, logo (upload ou URL), nom hôtel — live sans redéploiement |

**Sécurité :** Authentification JWT (8h), token en sessionStorage, route guard sur toutes les pages protégées.

---

## Variables d'environnement

| Variable                | Description                              | Obligatoire |
|-------------------------|------------------------------------------|-------------|
| `DB_ROOT_PASSWORD`      | Mot de passe root MySQL                  | Oui         |
| `DB_PASSWORD`           | Mot de passe utilisateur MySQL           | Oui         |
| `OPENWEATHERMAP_API_KEY`| Clé OpenWeatherMap (météo)              | Non (mock)  |
| `FLIGHTAPI_KEY`         | Clé FlightAPI.io (vols temps réel)       | Non (mock)  |
| `HOTEL_AIRPORT_IATA`    | Code IATA aéroport par défaut (ex: OUA)  | Non (OUA)   |
| `ADMIN_USERNAME`        | Login backoffice (défaut : `admin`)      | Non         |
| `ADMIN_PASSWORD`        | Mot de passe backoffice                  | Non         |
| `JWT_SECRET`            | Secret de signature JWT                  | Non (défaut dev) |
| `HOTEL_LAT` / `HOTEL_LNG` | Coordonnées GPS de l'hôtel            | Non (Ouaga) |
| `IDLE_TIMEOUT_MS`       | Délai inactivité avant retour accueil    | Non (30000) |

---

## Endpoints API

```
GET  /api/health                         Santé du serveur
GET  /api/weather/current                Météo actuelle + prévisions 7 jours
GET  /api/flights?type=arrivals&airport=OUA  Vols (arrivals|departures)
GET  /api/flights/search?flight=ET937        Recherche par numéro de vol
GET  /api/wellness?locale=fr             Services bien-être
GET  /api/events?locale=fr&category=...  Agenda événements
GET  /api/poi?locale=fr&category=...     Points d'intérêt
GET  /api/info?locale=fr                 Contacts utiles
GET  /api/notifications                  Notifications actives (borne)
GET  /api/theme                          Configuration thème
GET  /api/analytics/summary              Stats interactions 24h
POST /api/analytics                      Enregistrer une interaction
GET  /api/qr?section=...                 QR code base64

POST /api/admin/login                    Authentification admin
GET  /api/admin/wellness                 Liste services (admin)
POST /api/admin/wellness                 Créer service
PUT  /api/admin/wellness/:id             Modifier service
DELETE /api/admin/wellness/:id           Supprimer service
[Idem pour /admin/events, /admin/notifications, /admin/poi, /admin/info]
GET  /api/admin/theme                    Config thème (admin)
PUT  /api/admin/theme                    Modifier thème
POST /api/admin/theme/logo               Upload logo
GET  /api/admin/analytics?days=7         Stats interactions (admin)
GET  /api/admin/flights/config           Config vols (aéroport, intervalle, auto-refresh)
PUT  /api/admin/flights/config           Modifier config vols + redémarrer scheduler
POST /api/admin/flights/refresh          Rafraîchissement manuel des vols
GET  /api/admin/flights/credits          Crédits FlightAPI utilisés/restants
POST /api/admin/flights/credits/reset    Remettre le compteur de crédits à zéro
GET  /api/admin/flights/debug            Diagnostic API FlightAPI (dev)
POST /api/admin/weather/refresh          Rafraîchissement météo manuel
```

---

## Mode offline

L'application est **offline-first** :
- Le **Service Worker** (`public/sw.js`) met en cache les assets statiques
- L'**intercepteur Axios** lit le `localStorage` si le réseau est coupé
- Le **backend** retourne des données mock si une API externe est indisponible
- Une **bannière orange** s'affiche en cas de perte de connexion

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

À faire après chaque session de travail :

```bash
# 1. Voir ce qui a changé
git status

# 2. Ajouter tous les fichiers modifiés
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

| Section              | Statut      |
|----------------------|-------------|
| Menu d'accueil       | ✅ Complet  |
| Météo                | ✅ Complet  |
| Vols                 | ✅ Complet  |
| Bien-être            | ✅ Complet  |
| Agenda événements    | ✅ Complet  |
| Carte & POI (Leaflet)| ✅ Complet  |
| Infos utiles         | ✅ Complet  |
| Transfert mobile     | ✅ Complet  |
| Multilingue FR/EN    | ✅ Complet  |
| Mode offline         | ✅ Complet  |
| Analytics            | ✅ Complet  |
| Backoffice admin     | ✅ Complet  |
| Mode nuit auto       | ✅ Complet  |
| Animations transitions| ✅ Complet |
