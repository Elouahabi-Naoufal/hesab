#!/bin/sh
set -e

echo ">> Hesab starting..."

# Ensure data dir exists
mkdir -p /app/data

# Ensure symlink
if [ ! -L /app/prisma/data ]; then
  rm -rf /app/prisma/data
  ln -s /app/data /app/prisma/data
fi

# Run migrations (prisma migrate deploy is for production)
echo ">> Running prisma migrate deploy..."
if [ -f /app/prisma/migrations/migration_lock.toml ] || ls /app/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  # Use npx prisma from node_modules
  npx prisma migrate deploy
else
  echo ">> No migrations found, skipping"
fi

# Enable WAL mode (best effort)
echo ">> Enabling WAL mode..."
sqlite3 /app/data/app.db "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;" || echo "WAL setup skipped (db may not exist yet)"

# Generate client if needed (already generated at build)

echo ">> Starting server..."
exec "$@"
