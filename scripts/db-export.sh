#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-export.sh — Exporte les données vivantes de la BDD vers
#                database/seeds/data_live.sql
#
# Usage :
#   ./scripts/db-export.sh           # utilise les valeurs du .env
#   DB_PASSWORD=xxx ./scripts/db-export.sh
#
# Le fichier généré est commité dans git et rechargé automatiquement
# lors d'un déploiement sur un serveur vierge (docker-entrypoint-initdb.d).
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

# ── Tables à exclure (schéma géré par migrations, données techniques) ─────────
EXCLUDE_TABLES=(
  audit_log
  workflow_notifications
  feedbacks
)

IGNORE_ARGS=()
for tbl in "${EXCLUDE_TABLES[@]}"; do
  IGNORE_ARGS+=("--ignore-table=${DB_NAME}.${tbl}")
done

# ── Dump : données uniquement (CREATE TABLE géré par init.sql + migrations) ──
docker exec "$CONTAINER" mysqldump \
  -u "$DB_USER" -p"$DB_PASSWORD" \
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
