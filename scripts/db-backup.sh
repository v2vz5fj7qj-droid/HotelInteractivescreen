#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup.sh — Sauvegarde COMPLÈTE de la base (schéma + toutes les données)
#
# À lancer sur le serveur de production AVANT chaque mise à jour.
#
# Usage :
#   ./scripts/db-backup.sh              # sauvegarde dans backups/
#   KEEP=30 ./scripts/db-backup.sh      # conserve les 30 dernières
#
# Ne pas confondre avec db-export.sh :
#   db-backup.sh → tout, y compris logs, analytics, feedbacks, bornes.
#                  Destination : backups/ (hors git). Sert à restaurer.
#   db-export.sh → contenu éditorial seul, destination database/seeds/data_live.sql
#                  (versionné). Sert à amorcer un nouveau déploiement.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
ENV_FILE="$ROOT/.env"
OUT_DIR="$ROOT/backups"
KEEP="${KEEP:-10}"

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

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌  Conteneur '$CONTAINER' introuvable. Lance d'abord : docker compose up -d mysql"
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date '+%Y%m%d_%H%M%S')"
OUT="$OUT_DIR/connectbe_${STAMP}.sql.gz"

echo "💾  Sauvegarde complète de ${DB_NAME}…"

# --routines / --triggers / --events : on veut un dump restaurable tel quel.
# Pas de --no-create-info : le schéma fait partie de la sauvegarde.
docker exec "$CONTAINER" mysqldump \
  -u "$DB_USER" -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$DB_NAME" 2>/dev/null | gzip > "$OUT"

if [ ! -s "$OUT" ]; then
  echo "❌  La sauvegarde est vide — vérifie les identifiants dans .env"
  rm -f "$OUT"
  exit 1
fi

echo "✅  $OUT  ($(du -h "$OUT" | cut -f1))"

# ── Rotation : ne conserver que les KEEP plus récentes ───────────────────────
COUNT=$(find "$OUT_DIR" -maxdepth 1 -name 'connectbe_*.sql.gz' | wc -l | tr -d ' ')
if [ "$COUNT" -gt "$KEEP" ]; then
  find "$OUT_DIR" -maxdepth 1 -name 'connectbe_*.sql.gz' | sort | head -n "$((COUNT - KEEP))" | while read -r old; do
    rm -f "$old"
    echo "🗑   Purgée : $(basename "$old")"
  done
fi

echo ""
echo "   Pour restaurer cette sauvegarde :"
echo "   gunzip -c $OUT | docker exec -i $CONTAINER mysql -u $DB_USER -p'<mot de passe>' $DB_NAME"
