#!/usr/bin/env bash
# Consistent logical backup of the AquaPiol database.
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

if [ -f .env ]; then
  set -a
  # Only database connection keys are sourced; the rest of .env is left alone.
  eval "$(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=' .env)"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-aquapiol_inventory}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
MYSQLDUMP="${MYSQLDUMP:-/c/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysqldump.exe}"

if [ ! -x "$MYSQLDUMP" ]; then
  MYSQLDUMP="$(command -v mysqldump || true)"
fi

if [ -z "$MYSQLDUMP" ]; then
  echo "mysqldump not found. Set MYSQLDUMP to the binary path." >&2
  exit 1
fi

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${DB_NAME}-${STAMP}.sql"

MYSQL_PWD="$DB_PASSWORD" "$MYSQLDUMP" \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --routines --triggers --no-tablespaces \
  "$DB_NAME" > "$OUT"

echo "✅ Backup written to $OUT"
echo "   Restore with: mysql -u $DB_USER -p $DB_NAME < $OUT"
