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

# Run migrations as nextjs so app.db is owned by nextjs (not root) —
# otherwise SQLite is readonly for the server ("attempt to write a readonly database")
echo ">> Running prisma migrate deploy..."
run_as_nextjs() {
  if [ "$(id -u)" = "0" ]; then su-exec nextjs:nodejs "$@"; else "$@"; fi
}
if [ -f /app/prisma/migrations/migration_lock.toml ] || ls /app/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  # Use local prisma 5.22.0 (avoid npx fetching prisma 8 RC which fails with npm 11)
  run_as_nextjs ./node_modules/.bin/prisma migrate deploy || run_as_nextjs npx prisma@5.22.0 migrate deploy
else
  echo ">> No migrations found, skipping"
fi
# Re-assert ownership after migrate (migrate may create new files)
chown -R nextjs:nodejs /app/data 2>/dev/null || true
chmod -R 775 /app/data 2>/dev/null || true

# Enable WAL mode (best effort)
echo ">> Enabling WAL mode..."
run_as_nextjs sqlite3 /app/data/app.db "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;" || echo "WAL setup skipped (db may not exist yet)"

# Generate client if needed (already generated at build)

echo ">> Starting server..."
# Drop privileges: run as nextjs if we are root
if [ "$(id -u)" = "0" ]; then
  exec su-exec nextjs:nodejs "$@"
else
  exec "$@"
fi
