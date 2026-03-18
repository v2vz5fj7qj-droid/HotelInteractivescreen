# ConnectBé — Borne Interactive Hôtel

Concierge numérique tactile pour hôtel — Ouagadougou, Burkina Faso.

> **Racine du projet :** `/Users/macbookpro16/Documents/Projets dev/HotelInteractivescreen/`

---

## Ports utilisés

| Service | Port hôte | Port interne |
|---|---|---|
| **Frontend (borne)** | **5173** | 3000 |
| **Backend API** | **4001** | 4000 |
| **MySQL** | **3307** | 3306 |
| **Redis** | non exposé | 6379 |

> Ces ports ont été choisis pour éviter les conflits avec d'autres services déjà actifs sur la machine.

---

## Prérequis

| Outil | Version minimale | Vérification |
|---|---|---|
| [Node.js](https://nodejs.org) | 20.x | `node -v` |
| [Docker](https://www.docker.com) | 24.x | `docker -v` |
| [Docker Compose](https://docs.docker.com/compose/) | 2.x | `docker compose version` |
| npm | 10.x | `npm -v` |

---

## 1. Configuration initiale

```bash
# Se placer dans le dossier du projet
cd "HotelInteractivescreen"

# Copier les variables d'environnement
cp .env.example .env
```

Ouvrir `.env` et renseigner au minimum :

```env
# Clés API (laisser vide pour utiliser les données mock)
OPENWEATHERMAP_API_KEY=votre_clé_ici
AVIATIONSTACK_API_KEY=votre_clé_ici

# Mots de passe base de données
DB_ROOT_PASSWORD=un_mot_de_passe_fort
DB_PASSWORD=un_autre_mot_de_passe
```

> **Sans clés API**, l'application fonctionne avec des **données de démonstration** (mock).
> Aucune clé n'est obligatoire pour lancer et tester localement.

---

## 2. Lancement complet (Docker — recommandé)

Lance toute la stack en une commande :

```bash
docker compose up --build
```

| Service | URL locale |
|---|---|
| **Frontend (borne)** | http://localhost:5173 |
| **Backend API** | http://localhost:4001 |
| **MySQL** | localhost:3307 |
| **Redis** | réseau interne Docker uniquement |

Pour stopper :
```bash
docker compose down
```

Pour stopper et supprimer les données :
```bash
docker compose down -v
```

---

## 3. Lancement en développement (sans Docker)

### 3.1 Démarrer les dépendances (MySQL + Redis via Docker)

```bash
# Démarrer uniquement la base de données et le cache
docker compose up mysql redis -d
```

Attendre que MySQL soit prêt (environ 20 secondes) :
```bash
docker compose logs mysql --follow
# Attendre le message : "ready for connections"
```

### 3.2 Backend

```bash
cd backend
npm install
npm run dev
```

Le serveur écoute sur **http://localhost:4001**.

Vérifier que l'API répond :
```bash
curl http://localhost:4001/api/health
# Attendu : {"status":"ok","ts":...}
```

### 3.3 Frontend

Dans un **nouveau terminal** :

```bash
cd frontend
npm install
npm run dev
```

L'interface est disponible sur **http://localhost:5173**.

---

## 4. Structure des variables d'environnement

```
.env                    ← Variables actives (ignoré par git)
.env.example            ← Modèle à copier
```

| Variable | Description | Obligatoire |
|---|---|---|
| `OPENWEATHERMAP_API_KEY` | Clé OpenWeatherMap | Non (mock si absent) |
| `AVIATIONSTACK_API_KEY` | Clé AviationStack | Non (mock si absent) |
| `DB_ROOT_PASSWORD` | Mot de passe root MySQL | Oui |
| `DB_PASSWORD` | Mot de passe utilisateur MySQL | Oui |
| `HOTEL_LAT` / `HOTEL_LNG` | Coordonnées GPS de l'hôtel | Non (Ouaga par défaut) |
| `KIOSK_PUBLIC_URL` | URL publique pour les QR codes | Non (localhost:5173) |
| `IDLE_TIMEOUT_MS` | Délai inactivité en ms | Non (30000) |

---

## 5. Endpoints API principaux

```
GET  /api/health              → Santé du serveur
GET  /api/weather/current     → Météo actuelle + prévisions 7 jours
GET  /api/flights?type=arrivals|departures   → Liste vols OUA
GET  /api/flights/search?flight=AH110        → Recherche vol
GET  /api/wellness?locale=fr  → Services bien-être
GET  /api/wellness/:id        → Détail d'un service
GET  /api/events?locale=fr&category=music    → Agenda événements (upcoming par défaut)
GET  /api/events/:id                         → Détail d'un événement
GET  /api/poi?locale=fr&category=restaurant  → Points d'intérêt
GET  /api/info?locale=fr      → Contacts utiles
GET  /api/qr?section=weather  → QR code base64
GET  /api/theme               → Configuration thème
PUT  /api/theme               → Modifier le thème (body: { updates: {} })
POST /api/analytics           → Enregistrer un événement
GET  /api/analytics/summary   → Stats 24h
```

---

## 6. Personnaliser le thème ConnectBé

Le thème est modifiable sans redéploiement via l'API :

```bash
curl -X PUT http://localhost:4001/api/theme \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "hotel_name":    "Mon Hôtel",
      "color_primary": "#1A6B3C",
      "color_secondary": "#A8D580",
      "logo_url": "/images/mon-logo.png"
    }
  }'
```

Clés modifiables : `hotel_name`, `color_primary`, `color_primary_dark`, `color_secondary`,
`color_accent`, `color_bg_dark`, `color_bg_light`, `font_primary`, `font_secondary`,
`logo_url`, `logo_url_dark`, `idle_timeout_ms`.

---

## 7. Mode kiosque (borne physique)

### Linux / Ubuntu (recommandé)

```bash
# Lancer Chromium en plein écran sur la borne
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  --start-fullscreen \
  --app=http://localhost:5173
```

### Windows

```batch
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --app=http://localhost:5173 ^
  --disable-pinch ^
  --overscroll-history-navigation=0
```

### Autostart au démarrage (Linux / systemd)

Créer `/etc/systemd/system/connectbe-kiosk.service` :

```ini
[Unit]
Description=ConnectBé Kiosk
After=network.target

[Service]
Type=simple
User=kiosk
WorkingDirectory=/opt/connectbe
ExecStart=docker compose up
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable connectbe-kiosk
sudo systemctl start connectbe-kiosk
```

---

## 8. Base de données — Accès direct

```bash
# Connexion MySQL via Docker (port hôte 3307)
docker exec -it connectbe_mysql mysql -u connectbe_user -p connectbe_kiosk

# Ou depuis un client externe (TablePlus, DBeaver…)
# Host: 127.0.0.1  Port: 3307  User: connectbe_user  DB: connectbe_kiosk

# Vérifier les services bien-être
SELECT id, slug, price_fcfa, available_hours FROM wellness_services;

# Ajouter un service bien-être
INSERT INTO wellness_services (slug, duration_min, price_fcfa, available_hours, available_days)
VALUES ('hammam', 60, 35000, '10:00-19:00', 'Lun-Sam');

INSERT INTO wellness_service_translations (service_id, locale, name, description)
VALUES (LAST_INSERT_ID(), 'fr', 'Hammam', 'Bain de vapeur traditionnel.');
```

---

## 9. Mode offline

L'application est **offline-first** :

- Le **Service Worker** (`public/sw.js`) met en cache les assets statiques et les réponses API.
- L'**intercepteur Axios** (`services/api.js`) lit le `localStorage` si le réseau est coupé.
- Le **backend** retourne des données mock si une API externe est indisponible.
- Une **bannière orange** s'affiche automatiquement en cas de perte de connexion.

---

## 10. Commandes utiles

```bash
# Voir les logs en temps réel
docker compose logs -f backend
docker compose logs -f frontend

# Reconstruire après modification du code
docker compose up --build backend

# Vider le cache Redis
docker exec -it connectbe_redis redis-cli FLUSHALL

# Sauvegarder la base de données
docker exec connectbe_mysql mysqldump -u connectbe_user -p connectbe_kiosk > backup.sql

# Restaurer une sauvegarde
docker exec -i connectbe_mysql mysql -u connectbe_user -p connectbe_kiosk < backup.sql
```

---

## Sections développées

| Section | Sprint | Statut |
|---|---|---|
| Menu radial animé | S1 | ✅ Complet |
| Météo (7 jours + métriques) | S2 | ✅ Complet |
| Vols (arrivées/départs/recherche) | S2 | ✅ Complet |
| Services Bien-être (liste + détail infos résa) | S2 | ✅ Complet |
| Transfert Mobile (QR code dynamique) | S2 | ✅ Complet |
| Agenda Événements (filtres + détail) | S2 | ✅ Complet |
| Carte Leaflet + POI | S3 | 🔜 À venir |
| Infos utiles (contacts) | S3 | 🔜 À venir |
| Multilingue FR/EN | S1-S2 | ✅ Complet |
| Mode offline (SW + cache) | S2 | ✅ Complet |
| Analytics interactions | S2 | ✅ Complet |
| Thème personnalisable via API | S2 | ✅ Complet |
