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
JWT_SECRET=une_chaine_aleatoire_strictement_superieure_a_32_caracteres
```

> Pour générer un `JWT_SECRET` fort :
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

> Les clés API (météo, vols, carte) sont **facultatives** — l'app fonctionne avec des données de démo sans elles.

> **Mot de passe admin par défaut :** `connectbe2026` (variable `ADMIN_PASSWORD` dans `.env`). Appliqué automatiquement
> au **premier démarrage** du backend sur le compte super-admin (`admin@iconnectbe.com`) — voir
> [Premier mot de passe super-admin](#premier-mot-de-passe-super-admin) ci-dessous. Changer en production.

---

## Mode A — Docker complet (le plus simple)

Tout démarre en une seule commande :

```bash
# Développement : serveur Vite + rechargement à chaud
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

> **Production** : `docker compose up --build` (sans `-f`) construit le frontend et le sert
> avec nginx. C'est le mode par défaut, volontairement : un serveur de développement n'a rien
> à faire sur un VPS. Voir [Mettre à jour une production en service](README.md#mettre-à-jour-une-production-en-service).

> **La première fois prend 5-10 minutes** : téléchargement des images Docker + chargement des modèles de langue LibreTranslate (traduction automatique). Les démarrages suivants sont instantanés.

> **Après toute modification du code source** (`.jsx`, `.js`), les fichiers sont rechargés à chaud grâce aux volumes Docker — aucun rebuild nécessaire. Cela vaut **uniquement en mode développement** : en production le frontend est compilé dans l'image, il faut `docker compose up -d --build frontend`.

> **Après l'ajout ou la mise à jour d'une dépendance npm** (`package.json` modifié), il faut
> reconstruire le service concerné **et renouveler son volume de `node_modules`** :
> ```bash
> # Dépendance frontend ajoutée (ex. jspdf, leaflet…)
> docker compose up -d --build --renew-anon-volumes --no-deps frontend
>
> # Dépendance backend ajoutée (ex. adm-zip, helmet…)
> docker compose up -d --build --renew-anon-volumes --no-deps backend
> ```
> Les `node_modules` sont isolés dans l'image Docker et ne sont pas partagés avec le dossier
> local — `npm install` en local n'impacte pas le conteneur.
>
> ⚠️ **`--renew-anon-volumes` n'est pas optionnel** pour le backend, ni pour le frontend en mode
> dev. Ces deux services déclarent `/app/node_modules` comme volume **anonyme** (dans
> `docker-compose.yml` pour le backend, dans `docker-compose.dev.yml` pour le frontend) afin que
> les `node_modules` de l'hôte ne masquent pas ceux de l'image. Or un volume anonyme **survit à la
> recréation du conteneur** : sans ce drapeau, l'image est bien reconstruite avec la nouvelle
> dépendance, mais le conteneur remonte l'ancien volume par-dessus et le `require()` échoue.
> Le symptôme est déroutant — le build réussit, le module reste introuvable.
> Le frontend de **production** n'a pas ce volume : le drapeau y est simplement sans effet.
>
> ⚠️ **`--no-deps` évite un dégât collatéral.** `backend` dépend de `mysql`, `frontend` dépend de
> `backend` : sans ce drapeau, Compose peut entraîner les services dont dépend celui que vous
> reconstruisez. Combiné à `--force-recreate`, cela va jusqu'à recréer le conteneur MySQL — qui
> peut échouer sur un conflit de nom et laisser la pile à l'arrêt. Les données survivent
> (`mysql_data` est un volume **nommé**), mais le service tombe. N'utilisez jamais
> `--force-recreate` sans `--no-deps`.

| Service          | URL                          |
|------------------|------------------------------|
| Borne kiosque    | http://localhost:5173        |
| Backoffice admin | http://localhost:5173/admin  |
| API backend      | http://localhost:4001        |
| MySQL            | localhost:3307               |
| Redis            | localhost:6380               |

Pour arrêter :

```bash
docker compose down
```

---

## Mode B — Dev local avec hot-reload (recommandé pour coder)

**Terminal 1 — Services Docker (BDD + traduction)**
```bash
docker compose up mysql redis libretranslate -d
# Attendre ~20s que MySQL soit prêt
# LibreTranslate démarre en arrière-plan (lent la première fois)
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

La plateforme dispose de **3 niveaux d'accès** distincts :

| Rôle | URL d'accès | Login par défaut | Mot de passe |
|----|---|---|---|
| Super-admin | http://localhost:5173/admin | `admin@iconnectbe.com` | `connectbe2026` (valeur de `ADMIN_PASSWORD`) |
| Hotel-admin | http://localhost:5173/admin | selon création | selon création |
| Contributeur | http://localhost:5173/admin | selon création | selon création |

### Premier mot de passe super-admin

La migration `database/migrations/001_multi_hotel.sql` seed le compte `admin@iconnectbe.com` avec un
`password_hash` **placeholder** (`$2b$10$placeholder_hash_to_replace`), non fonctionnel tel quel. Au tout premier
démarrage du backend, `runMigrations()` (voir `backend/src/services/runMigrations.js`, `migration016`) détecte ce
placeholder et le remplace automatiquement par le hash bcrypt de la variable **`ADMIN_PASSWORD`** définie dans `.env`.
Aucune manipulation manuelle n'est donc nécessaire dans le cas normal.

Cette étape ne s'exécute **qu'une seule fois** : une fois le hash remplacé (ici ou via le backoffice), les
redémarrages suivants ne touchent plus jamais au mot de passe — changer `ADMIN_PASSWORD` dans `.env` après coup
n'aura aucun effet. Pour changer le mot de passe ensuite, utiliser la page **Utilisateurs** du backoffice super-admin.

<details>
<summary>Dépannage — réinitialiser manuellement si besoin (compte créé avant l'ajout de ce mécanisme, <code>ADMIN_PASSWORD</code> absente au premier boot, mot de passe oublié…)</summary>

```bash
cd backend
node -e "require('bcrypt').hash('VOTRE_MOT_DE_PASSE', 10).then(console.log)"
```

```bash
docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk \
  -e "UPDATE admin_users SET password_hash = '<hash_généré>' WHERE email = 'admin@iconnectbe.com';"
```

</details>

> **Authentification admin :** depuis le durcissement sécurité, le JWT n'est plus renvoyé dans le corps de la
> réponse ni stocké en `localStorage`/`sessionStorage` — il est posé dans un cookie `HttpOnly` + `SameSite=Strict`
> (`admin_token`, scope `/api/admin`). Pour tester l'API en dehors du navigateur (Postman, curl), le header
> `Authorization: Bearer <token>` reste accepté en repli par le middleware `adminAuth`.

### Super-admin — fonctionnalités

- **Tableau de bord** — vue globale, notifications de workflow (soumissions en attente)
- **Hôtels** — CRUD des hôtels, bouton **Configurer** par hôtel
  - Onglet **Paramètres** : logo, image de fond, couleurs, messages d'accueil FR/EN, contacts, WiFi, check-in/check-out
  - Onglet **Sections** : activer ou masquer chaque section du kiosque pour cet hôtel
  - Onglet **Météo** : affectation des localités météo (max 5), localité par défaut, refresh manuel
  - Onglet **Aéroports** : affectation/retrait des aéroports du système à l'hôtel
  - Onglet **Devises** : configuration du convertisseur de devises affiché sur la borne (même module que côté hotel-admin)
  - Onglet **Codes séjour** : codes d'accès client de l'hôtel (même module que côté hotel-admin)
- **Carte & Lieux** — validation des soumissions avec **vue détaillée** (coords GPS + lien OpenStreetMap) avant publication ou rejet motivé
- **Agenda** — validation des soumissions avec **vue détaillée** (titre, description, dates, lieu, contributeur) avant publication ou rejet motivé
- **Infos utiles** — validation des soumissions avec **vue détaillée** (contacts, description) avant publication ou rejet motivé
- **Météo** — gestion centralisée des localités météo disponibles
- **Aéroports** — CRUD aéroports, planification (intervalle ou heures fixes), refresh forcé
- **Utilisateurs** — création/gestion des comptes (tous rôles), permissions contributeurs
- **Tokens FlightAPI** — suivi de consommation de crédits
- **Audit log** — historique de toutes les actions
- **Bornes kiosques** — liste de toutes les bornes enregistrées, statut temps réel (en ligne / hors ligne / désactivée / jamais vue), génération de clés d'inscription avec expiration configurable, copie de clé, toggle actif/inactif, suppression
- **Sauvegarde & restauration** — export/import d'archives `.zip` sur trois périmètres (un établissement, catalogue partagé, instance complète), essai à blanc avant écriture, instantanés conservés sur le serveur avec restauration en un clic

### Hotel-admin — fonctionnalités

- **Paramètres hôtel** — logo, fond, thème couleurs, contacts, WiFi, code check-in/check-out
- **Images de bannière** — galerie carrousel affichée sur la borne (upload, réordonnancement, max 10 images)
- **Services** — CRUD services avec catégories
- **Agenda** — CRUD événements propres à l'hôtel
- **Bon à savoir** — informations propres à l'hôtel ; les fiches marquées "notification" apparaissent avec une icône clochette sur la borne
- **Évaluations** — statistiques et liste des feedbacks soumis depuis la borne (filtres date/note, export CSV et PDF)
- **Police personnalisée** — upload `.ttf`/`.otf` pour remplacer la police de la borne (section "Paramètres hôtel")
- **Devises** — convertisseur de devises affiché sur la borne : devise de base, devises cibles (max 10), tableau des taux (max 5), mise à jour automatique via [open.er-api.com](https://www.exchangerate-api.com/) (sans clé par défaut) ou manuelle
- **Dashboard** — soumissions en attente de pré-validation
- **Bornes kiosques** — liste des bornes de l'hôtel avec statut temps réel, toggle actif/inactif
- **Codes d'accès client** — codes de séjour remis aux clients : création à l'unité ou en lot, fiche imprimable (QR + code), appareils rattachés, révocation
- **Sauvegarde & restauration** — export/import de la configuration et du contenu de son établissement (réservé à `hotel_admin` — un compte `hotel_staff` n'y a pas accès)

### Contributeur — fonctionnalités

- **Mes lieux** — soumettre/corriger des points d'intérêt (si permission accordée)
- **Mes événements** — soumettre/corriger des événements (si permission accordée)
- **Mes infos utiles** — soumettre/corriger des contacts utiles (si permission accordée)
- Suivi du statut de chaque soumission (en attente / pré-approuvé / publié / rejeté + motif)

> Les comptes sont créés et gérés par le super-admin depuis la page **Utilisateurs**.

> **Important :** Après avoir saisi des données via le backoffice, ne jamais relancer avec `docker compose down -v` — le flag `-v` supprime les volumes et efface la base de données. Utiliser simplement `docker compose down` puis `docker compose up -d`.

---

## Appliquer le schéma base de données

Le schéma complet vit dans `database/init.sql`. Il ne contient **que de la structure**
(`CREATE TABLE IF NOT EXISTS`, aucun `DROP`, aucune donnée) : le rejouer sur une base
peuplée est sans risque et se contente d'ajouter les tables manquantes.

```bash
docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk \
  < database/init.sql
```

### Ce qui est chargé au premier démarrage

Les trois fichiers montés dans `docker-entrypoint-initdb.d` ne sont joués **qu'une seule
fois**, sur un volume `mysql_data` vierge, et dans cet ordre :

| Ordre | Fichier | Contenu |
|-------|---------|---------|
| 01 | `database/init.sql` | Schéma complet (39 tables) |
| 02 | `database/seeds/bootstrap.sql` | Hôtel #1, super-admin, catégories, thème, aéroports |
| 03 | `database/seeds/data_live.sql` | Données réelles exportées (`REPLACE INTO`) |

Les colonnes ajoutées après coup sont posées au démarrage du backend par
`backend/src/services/runMigrations.js`, dont les migrations sont idempotentes.

> Les seeds de démonstration `wellness.sql`, `poi.sql` et `events.sql` ne sont plus montés
> automatiquement — ils faisaient double emploi avec `data_live.sql`. Pour les charger
> à la main : `docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk < database/seeds/poi.sql`

### Déployer avec ou sans les données

Au premier démarrage sur un serveur neuf, deux options :

- **Avec vos données** (défaut) — ne touchez à rien : `data_live.sql` est chargé et vous
  retrouvez hôtels, lieux, événements, services et comptes tels qu'exportés.
- **Base vierge** — commentez la ligne `03_data_live.sql` dans `docker-compose.yml` avant
  le premier `docker compose up`. Vous démarrez avec un seul hôtel, le compte super-admin
  et les catégories, sans aucun contenu métier.

> Le choix se joue **uniquement au premier démarrage**. Une fois le volume `mysql_data`
> créé, ces fichiers ne sont plus relus. Pour repartir de zéro :
> `docker compose down -v` (⚠️ efface définitivement la base).

---

## Activer une borne kiosque (Android / Fully Kiosk Browser)

### Première activation (inscription)

1. **Générer une clé** depuis le backoffice super-admin → **Bornes kiosques** → "🔑 Gérer les clés" → sélectionner l'hôtel → **Générer la clé**
2. **Copier la clé** (format `XXXXXX-XXXXXX-XXXXXX`, valable 72h par défaut)
3. **Ouvrir l'URL de la borne** sur l'appareil Android : `http://votre-domaine.com/<hotel-slug>`
4. L'écran d'inscription s'affiche automatiquement → **coller la clé** → **Activer la borne**
5. La borne est maintenant enregistrée et envoie un heartbeat toutes les 5 minutes

> La clé est à usage unique et liée à un hôtel — elle sera rejetée si utilisée sur une URL d'un autre hôtel.

### Démarrages suivants

Au redémarrage du navigateur, la borne s'authentifie **silencieusement** (token stocké en localStorage). Aucune clé n'est redemandée.

> Si le localStorage est vidé (réinitialisation de l'appareil), l'écran d'inscription réapparaît. Générer une nouvelle clé depuis le backoffice.

### Mode test (sans inscription)

Pour accéder à l'interface sans enregistrer de borne :

```
http://localhost:5173/<hotel-slug>?bypass=1
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

## Tester depuis un téléphone

Utile pour vérifier le transfert mobile (QR code) ou l'affichage de la borne sur un vrai appareil.

1. Récupérer l'IP locale de la machine qui fait tourner le projet :

   ```bash
   # macOS
   ipconfig getifaddr en0
   # Linux
   hostname -I | awk '{print $1}'
   ```

2. Sur le téléphone, connecté au **même réseau Wi-Fi**, ouvrir `http://<IP>:5173`
   (par exemple `http://192.168.11.111:5173`).

3. Pour l'**espace visiteur** (accès client par code de séjour), ouvrir
   `http://<IP>:5173/<slug-hôtel>/visiteur` et saisir un code créé depuis
   **Codes d'accès client** dans le back-office — ou scanner directement le QR de la fiche
   imprimable, qui porte le code (`?c=…`).

> **Erreur `CORS: origine non autorisée — http://192.168.x.x:5173` dans les logs backend ?**
> Le navigateur envoie comme origine l'adresse tapée dans la barre d'URL : ce n'est plus
> `localhost`, donc le backend la refuse si elle n'est pas autorisée.
> En développement (`NODE_ENV` ≠ `production`) les IP du réseau local sont acceptées d'office.
> Sinon, ajouter l'origine dans le `.env` puis redémarrer le backend :
>
> ```bash
> CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.11.111:5173
> docker compose restart backend
> ```

---

## Sauvegarder et versionner les données

Les données saisies en backoffice (hôtels, événements, lieux, services, paramètres…) vivent dans
le volume Docker `mysql_data` et ne sont pas automatiquement dans git.

**Pour les commiter et les inclure dans un déploiement futur :**

```bash
# 1. Exporter le contenu éditorial
./scripts/db-export.sh

# 2. Commiter le dump
git add database/seeds/data_live.sql
git commit -m "chore: export données vivantes $(date +%Y-%m-%d)"
git push
```

**Pour une sauvegarde complète et restaurable** (schéma, contenus, logs, avis, bornes) :

```bash
./scripts/db-backup.sh        # → backups/connectbe_<date>.sql.gz, hors git
KEEP=30 ./scripts/db-backup.sh   # conserve les 30 dernières au lieu de 10
```

À lancer **sur le serveur, avant chaque mise à jour**.

Sur un **nouveau serveur** (`git clone` + `docker compose up --build`), le fichier
`database/seeds/data_live.sql` est rechargé automatiquement dans la BDD vierge.
Il est généré en `REPLACE INTO` : il écrase les lignes de `bootstrap.sql` chargées juste
avant, au lieu d'échouer sur des doublons de clé primaire.

> `db-export.sh` écarte les tables propres à une instance ou purement techniques :
> `audit_log`, `workflow_notifications`, `feedbacks`, `analytics_events`, `kiosks`,
> `kiosk_keys`, `qr_tokens`, `guest_codes`, `guest_sessions`. Pour tout conserver,
> utiliser `db-backup.sh`.

> ⚠️ **Ne jamais rejouer `data_live.sql` sur une production en service** — c'est un
> `REPLACE INTO` global, il écrase les saisies du client. Mise à jour d'une production :
> `./scripts/db-backup.sh` puis `git pull` puis `docker compose restart backend`.
> Le code et le schéma passent, les contenus ne bougent pas.

### Et pour que le client se débrouille seul

Les deux scripts ci-dessus exigent un accès SSH au serveur. Le back-office expose un
**troisième mécanisme**, utilisable par le client lui-même : **Sauvegarde & restauration**
(`/admin/hotel/backup`, ou `/admin/super/backup` pour tous les périmètres).

Il produit une archive `.zip` contenant configuration, contenu, traductions et médias — pas un
dump SQL. Les identifiants sont reconstruits à l'import, ce qui permet de restaurer sur une
**autre** installation ou de dupliquer un établissement, là où un `mysqldump` écraserait
l'hôtel n°1 ou casserait les clés étrangères.

| Besoin | Outil |
|---|---|
| Le serveur a brûlé | `scripts/db-backup.sh` |
| Amorcer un serveur vierge | `database/seeds/data_live.sql` |
| Le client veut sauvegarder son travail, dupliquer un hôtel, migrer | Back-office → Sauvegarde & restauration |

Détail du périmètre, des exclusions et des garde-fous :
[README — Sauvegarde & restauration de la configuration](README.md#sauvegarde--restauration-de-la-configuration-back-office).

---

## Clés API et variables d'environnement

Le fichier `.env` n'est **jamais commité** (données sensibles). Pour déployer sur un nouveau serveur :

```bash
# Sur le nouveau serveur — copier le template et remplir les valeurs
cp .env.example .env
nano .env   # ou vim, selon préférence
```

Les valeurs à renseigner obligatoirement :

| Variable | Description |
|---|---|
| `DB_ROOT_PASSWORD` | Mot de passe root MySQL |
| `DB_PASSWORD` | Mot de passe utilisateur MySQL |
| `JWT_SECRET` | Chaîne aléatoire ≥ 32 caractères |
| `ADMIN_PASSWORD` | Mot de passe super-admin — appliqué une seule fois au premier démarrage (voir [Premier mot de passe super-admin](#premier-mot-de-passe-super-admin)) |
| `OPENWEATHERMAP_API_KEY` | Météo (optionnel — mode mock si absent) |
| `FLIGHTAPI_KEY` | Vols temps réel (optionnel — mode mock si absent) |
| `ORS_API_KEY` | Itinéraires carte, proxifié côté backend (optionnel) |
| `VITE_CARTO_API_KEY` | Fond de carte CARTO (optionnel — sans clé, le fond de carte affiche "API KEY REQUIRED") |
| `CORS_ORIGINS` | Origines autorisées à appeler l'API, séparées par des virgules (optionnel — défaut `http://localhost:3000,http://localhost:5173`). En production, y mettre le domaine public ; en développement les IP du réseau local sont acceptées d'office, voir [Tester depuis un téléphone](#tester-depuis-un-téléphone) |
| `TRUST_PROXY` | À définir dès qu'nginx ou Cloudflare est devant le backend (production) — sans elle, `req.ip` vaut l'adresse du proxy pour tous les clients, et les limitations de débit deviennent un compteur unique partagé |
| `CONTENT_AUTH_ENFORCE` | Verrouillage des routes de contenu. Laisser `false` (mode observation journalisé) au premier déploiement, basculer à `true` **seulement après** que toutes les bornes en service ont rechargé le front — voir [README — mise en service du verrouillage](README.md#mise-en-service-du-verrouillage--dans-cet-ordre) |
| `GUEST_GRACE_HOURS`, `GUEST_RETENTION_DAYS`, `GUEST_FAILURE_BUDGET` | Accès client par code de séjour : marge après le départ (24 h), purge RGPD (30 j), échecs de saisie tolérés par minute (20) — voir [README — accès client](README.md#accès-client-par-code-de-séjour) |

> Pour transférer le `.env` entre machines sans le commiter, utiliser `scp` ou un gestionnaire de secrets (Bitwarden, 1Password, etc.).
> ```bash
> scp .env user@serveur:/opt/connectbe/.env
> ```

---

## Commandes utiles

```bash
# Voir les logs en temps réel
docker compose logs -f

# Réinitialiser complètement la base de données (⚠️ EFFACE toutes les données saisies)
docker compose down -v && docker compose up --build

# Vider le cache Redis
docker exec -it connectbe_redis redis-cli FLUSHALL

# Backup manuel ponctuel (hors versioning)
docker exec connectbe_mysql mysqldump -u connectbe_user -pchange_me_db connectbe_kiosk > backup_$(date +%Y%m%d).sql

# Restaurer un backup manuel
docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk < backup_20260501.sql
```

---

## Clés API (optionnelles)

| API                | Site                           | Plan gratuit         |
|--------------------|--------------------------------|----------------------|
| OpenWeatherMap     | openweathermap.org/api         | 1 000 appels/jour    |
| FlightAPI          | flightapi.io                   | 30 crédits (trial)   |
| OpenRouteService   | openrouteservice.org           | 2 000 req/jour       |
| ExchangeRate-API   | open.er-api.com                | Gratuit sans clé (1 500 req/mois avec clé) |
| CARTO Basemaps     | carto.com/basemaps             | Gratuit              |

> **FlightAPI — points importants :**
> - L'endpoint correct est `/compschedule/{API_KEY}` (clé dans le chemin, pas en query param)
> - Chaque appel consomme **2 crédits** (arrivées) ou **2 crédits** (départs)
> - Ajouter `dns: [8.8.8.8, 1.1.1.1]` dans le service `backend` du `docker-compose.yml` pour l'accès internet depuis Docker

> **Plein écran protégé :** Le mot de passe par défaut pour quitter le mode kiosque est `fs1234`. Il est modifiable depuis le backoffice → **Thème** (champ "Mot de passe plein écran").
