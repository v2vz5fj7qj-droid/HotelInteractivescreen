#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-export.sh — Exporte le CONTENU ÉDITORIAL de la BDD vers
#                database/seeds/data_live.sql
#
# Usage :
#   ./scripts/db-export.sh           # utilise les valeurs du .env
#   DB_PASSWORD=xxx ./scripts/db-export.sh
#
# Le fichier généré est commité dans git et rechargé UNE SEULE FOIS, à la
# création du volume, lors d'un déploiement sur un serveur vierge
# (docker-entrypoint-initdb.d).
#
# ⚠️  Ce fichier n'est PAS un mécanisme de mise à jour. Le rejouer sur une
#     production en service écraserait les saisies du client : c'est un
#     REPLACE INTO global, il ne distingue pas vos modifications des leurs.
#     Pour mettre à jour une production : git pull + docker compose restart
#     backend (le code et le schéma passent, les contenus ne bougent pas).
#
# Une fois la production vivante, c'est ELLE la source de vérité : lancez ce
# script sur le serveur, pas en local, pour rapatrier l'état réel dans git.
#
# Pour une sauvegarde complète et restaurable : scripts/db-backup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
ENV_FILE="$ROOT/.env"
OUT="$ROOT/database/seeds/data_live.sql"

# ── Charger les variables .env ────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DB_USER="${DB_USER:-connectbe_user}"
DB_PASSWORD="${DB_PASSWORD:-change_me_db}"
DB_NAME="${DB_NAME:-connectbe_kiosk}"
CONTAINER="${MYSQL_CONTAINER:-connectbe_mysql}"

# ── Vérifier que le conteneur tourne ─────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌  Conteneur '$CONTAINER' introuvable. Lance d'abord : docker compose up -d mysql"
  exit 1
fi

echo "📦  Export en cours depuis $CONTAINER ($DB_NAME)…"

# ── Tables exclues du seed ────────────────────────────────────────────────────
# Ce dump amorce un NOUVEAU déploiement : il ne doit contenir que du contenu
# éditorial. Tout ce qui est propre à une instance ou purement technique reste
# dehors — c'est le rôle de db-backup.sh de tout conserver.
EXCLUDE_TABLES=(
  audit_log               # journal d'audit
  workflow_notifications  # notifications internes du workflow
  feedbacks               # avis laissés sur les bornes
  analytics_events        # statistiques de consultation (près de la moitié du dump)
  kiosks                  # bornes enregistrées : device_token propre à chaque machine
  kiosk_keys              # clés d'activation à usage unique
  qr_tokens               # tokens de transfert mobile, durée de vie 10 minutes
)

IGNORE_ARGS=()
for tbl in "${EXCLUDE_TABLES[@]}"; do
  IGNORE_ARGS+=("--ignore-table=${DB_NAME}.${tbl}")
done

# ── Dump : données uniquement (CREATE TABLE géré par init.sql + migrations) ──
# --replace : REPLACE INTO au lieu d'INSERT INTO, pour que ce dump écrase les
# lignes de bootstrap.sql (chargé juste avant) au lieu d'échouer sur doublon.
docker exec "$CONTAINER" mysqldump \
  -u "$DB_USER" -p"$DB_PASSWORD" \
  --replace \
  --no-create-info \
  --no-create-db \
  --skip-triggers \
  --single-transaction \
  --set-gtid-purged=OFF \
  --disable-keys \
  --extended-insert \
  "${IGNORE_ARGS[@]}" \
  "$DB_NAME" > "$OUT"

# ── En-tête informatif ────────────────────────────────────────────────────────
TMP=$(mktemp)
cat > "$TMP" <<SQL
-- ════════════════════════════════════════════════════════════════════
--  ConnectBé — Données vivantes (data_live.sql)
--  Généré le : $(date '+%Y-%m-%d %H:%M:%S')
--  NE PAS ÉDITER MANUELLEMENT — utiliser scripts/db-export.sh
--
--  Tables exclues : ${EXCLUDE_TABLES[*]}
--  (logs, notifications, feedbacks — non essentiels au déploiement)
-- ════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

SQL
cat "$TMP" "$OUT" > "${OUT}.tmp" && mv "${OUT}.tmp" "$OUT"
echo "SET FOREIGN_KEY_CHECKS = 1;" >> "$OUT"
rm "$TMP"

echo "✅  Export terminé → database/seeds/data_live.sql"
echo ""
echo "   Pour commiter et pousser :"
echo "   git add database/seeds/data_live.sql"
echo "   git commit -m 'chore: export données vivantes $(date +%Y-%m-%d)'"
echo "   git push"
