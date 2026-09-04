#!/bin/bash
set -e

# Hesab restore script
# Usage: ./scripts/restore.sh ./backups/hesab-YYYYMMDD-HHMM.db

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

BACKUP_FILE="$1"
DATA_FILE="./data/app.db"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will overwrite ${DATA_FILE}"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted"
  exit 1
fi

# Stop container if running
if command -v docker >/dev/null 2>&1 && docker ps | grep -q hesab; then
  echo "Stopping container..."
  docker compose stop app || docker stop hesab || true
fi

echo "Restoring ${BACKUP_FILE} -> ${DATA_FILE}..."
cp "${BACKUP_FILE}" "${DATA_FILE}"
rm -f "${DATA_FILE}-wal" "${DATA_FILE}-shm"

echo "Restore completed. Restarting..."
if command -v docker >/dev/null 2>&1; then
  docker compose up -d app || echo "Start manually: docker compose up -d"
fi

echo "Done."
