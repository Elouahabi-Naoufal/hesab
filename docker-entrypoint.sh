#!/bin/sh
set -e

echo ">> Hesab starting..."

# Ensure data dir exists and is writable by nextjs (fix bind-mount root ownership)
mkdir -p /app/data
chown -R nextjs:nodejs /app/data 2>/dev/null || true
chmod -R 775 /app/data 2>/dev/null || true

# Ensure symlink
if [ ! -L /app/prisma/data ]; then
  rm -rf /app/prisma/data
  ln -s /app/data /app/prisma/data
fi

# Run migrations (prisma migrate deploy is for production)
echo ">> Running prisma migrate deploy..."
if [ -f /app/prisma/migrations/migration_lock.toml ] || ls /app/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  # Use local prisma 5.22.0 (avoid npx fetching prisma 8 RC which fails with npm 11)
  ./node_modules/.bin/prisma migrate deploy || npx prisma@5.22.0 migrate deploy
else
  echo ">> No migrations found, skipping"
fi

# Enable WAL mode (best effort)
echo ">> Enabling WAL mode..."
sqlite3 /app/data/app.db "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;" || echo "WAL setup skipped (db may not exist yet)"

# Generate client if needed (already generated at build)

echo ">> Starting server..."
# Drop privileges: run as nextjs if we are root
if [ "$(id -u)" = "0" ]; then
  exec su-exec nextjs:nodejs "$@"
else
  exec "$@"
fi
