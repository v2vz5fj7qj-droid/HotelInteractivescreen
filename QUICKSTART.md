# ConnectBé — Démarrage rapide

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré
- [Node.js](https://nodejs.org/) v20 LTS (recommandé)

---

## 1. Cloner et configurer

```bash
git clone https://github.com/VOTRE_USERNAME/HotelInteractivescreen.git
cd HotelInteractivescreen
cp .env.example .env
```

Ouvrir `.env` et remplir au minimum :

```
DB_ROOT_PASSWORD=motdepasse_root
DB_PASSWORD=motdepasse_db
```

> Les clés API (météo, vols) sont **facultatives** — l'app fonctionne avec des données de démo sans elles.

---

## Mode A — Docker complet (le plus simple)

Tout démarre en une seule commande :

```bash
docker compose up --build
```

> La première fois prend 2-3 minutes (téléchargement des images Docker).

> **Après toute modification du code frontend**, relancer avec `docker compose up --build frontend -d` pour reconstruire l'image.

| Service          | URL                          |
|------------------|------------------------------|
| Borne kiosque    | http://localhost:5173        |
| Backoffice admin | http://localhost:5173/admin  |
| API backend      | http://localhost:4001        |
| MySQL            | localhost:3307               |

Pour arrêter :

```bash
docker compose down
```

---

## Mode B — Dev local avec hot-reload (recommandé pour coder)

**Terminal 1 — Base de données (Docker uniquement)**
```bash
docker compose up mysql redis -d
# Attendre ~20s que MySQL soit prêt
```

**Terminal 2 — Backend**
```bash
cd backend
npm install    # une seule fois
npm run dev    # API sur http://localhost:4000
```

**Terminal 3 — Frontend**
```bash
cd frontend
npm install    # une seule fois
npm run dev    # Borne sur http://localhost:5173
```

> ⚠️ Ne jamais lancer les deux modes en même temps — ils partagent les mêmes ports.

---

## Backoffice admin

| URL                         | Login   | Mot de passe    |
|-----------------------------|---------|-----------------|
| http://localhost:5173/admin | `admin` | `connectbe2026` |

Fonctionnalités disponibles dans le backoffice :

- **Tableau de bord** — statistiques d'utilisation (7 jours), compteurs de contenu
- **Bien-être** — CRUD des services spa/massage/piscine (FR + EN, images, horaires, tarifs)
- **Agenda** — CRUD des événements (catégories, dates, lieu, mise en avant)
- **Bon à savoir** — Notifications affichées en rotation sur la borne (FR + EN)
- **Carte & POI** — Points d'intérêt sur la carte Leaflet (restaurants, pharmacies, taxis…)
- **Infos utiles** — Contacts de taxi, médecins, urgences, ambassades (FR + EN)
- **Localités météo** — Villes affichées dans la section météo + rafraîchissement manuel
- **Vols** — Aéroport IATA, intervalle de rafraîchissement, scheduler automatique, compteur de crédits FlightAPI
- **Thème** — Couleurs, logo, nom de l'hôtel (sans redéploiement)

> Les identifiants sont modifiables dans `backend/.env` via `ADMIN_USERNAME` et `ADMIN_PASSWORD` (valeurs par défaut : `admin` / `connectbe2026`).

> **Important :** Après avoir saisi des données via le backoffice, ne jamais relancer avec `docker compose down -v` — le flag `-v` supprime les volumes et efface la base de données. Utiliser simplement `docker compose down` puis `docker compose up -d`.

---

## Appliquer le schéma base de données

Si MySQL tourne déjà depuis une session précédente (avant l'ajout de tables) :

```bash
docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk \
  < database/init.sql
```

---

## Mode kiosque (écran tactile physique)

```bash
# macOS
open -a "Google Chrome" --args --kiosk --app=http://localhost:5173

# Linux
chromium-browser --kiosk --noerrdialogs --disable-infobars --app=http://localhost:5173

# Windows
start chrome --kiosk --app=http://localhost:5173
```

---

## Accès admin depuis la borne

Sur la borne en mode kiosque, **taper 5 fois rapidement** sur l'icône hôtel dans le header
pour accéder au backoffice sans lien visible.

---

## Commandes utiles

```bash
# Voir les logs en temps réel
docker compose logs -f

# Réinitialiser complètement la base de données (⚠️ EFFACE toutes les données saisies)
docker compose down -v && docker compose up --build

# Vider le cache Redis
docker exec -it connectbe_redis redis-cli FLUSHALL

# Sauvegarder la base de données
docker exec connectbe_mysql mysqldump -u connectbe_user -pchange_me_db connectbe_kiosk > backup.sql

# Restaurer une sauvegarde
docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk < backup.sql
```

---

## Clés API (optionnelles)

| API            | Site                     | Plan gratuit         |
|----------------|--------------------------|----------------------|
| OpenWeatherMap | openweathermap.org/api   | 1 000 appels/jour    |
| FlightAPI      | flightapi.io             | 30 crédits (trial)   |

> **FlightAPI — points importants :**
> - L'endpoint correct est `/compschedule/{API_KEY}` (clé dans le chemin, pas en query param)
> - Chaque appel consomme **2 crédits** (arrivées) ou **2 crédits** (départs)
> - Ajouter `dns: [8.8.8.8, 1.1.1.1]` dans le service `backend` du `docker-compose.yml` pour l'accès internet depuis Docker
