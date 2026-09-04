#!/bin/bash
set -e

# Hesab backup script — uses sqlite3 backup API
# Usage: ./scripts/backup.sh

DATA_FILE="./data/app.db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/hesab-${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

if [ ! -f "${DATA_FILE}" ]; then
  echo "No database found at ${DATA_FILE}"
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  echo "Backing up ${DATA_FILE} -> ${BACKUP_FILE} (SQLite backup API)..."
  sqlite3 "${DATA_FILE}" ".backup '${BACKUP_FILE}'"
  # Also vacuum into backup for integrity
  echo "Verifying backup..."
  sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;" | grep -q "ok" && echo "Integrity OK" || echo "Integrity check failed!"
else
  echo "sqlite3 not found, falling back to checkpoint + copy (risky if app is writing)..."
  # Try to checkpoint WAL first if possible
  if command -v docker >/dev/null 2>&1 && docker ps | grep -q hesab; then
    docker exec hesab sqlite3 /app/data/app.db "PRAGMA wal_checkpoint(TRUNCATE);" || true
  fi
  cp "${DATA_FILE}" "${BACKUP_FILE}"
  # Also copy WAL if exists
  [ -f "${DATA_FILE}-wal" ] && cp "${DATA_FILE}-wal" "${BACKUP_FILE}-wal" || true
  [ -f "${DATA_FILE}-shm" ] && cp "${DATA_FILE}-shm" "${BACKUP_FILE}-shm" || true
fi

echo "Backup completed: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"
