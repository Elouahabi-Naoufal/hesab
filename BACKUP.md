# Backup & Restore — Hesab (SQLite)

SQLite is the primary and authoritative database.

Database file:
- Local dev: `./data/app.db`
- Docker: `/app/data/app.db` (mounted as `./data:/app/data` on host)
- WAL files: `app.db-wal`, `app.db-shm` (when WAL mode enabled)

## Why WAL mode?

We enable WAL (Write-Ahead Logging) for concurrent reads/writes:

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
```

This is set automatically on startup via `docker-entrypoint.sh`.

## Backup (Safe)

**Do NOT just `cp app.db` while the app is running** if WAL is enabled — you need a consistent snapshot.

### Option 1: SQLite backup API (Recommended)

```bash
# Inside container or host with sqlite3 installed
sqlite3 data/app.db ".backup data/backup-$(date +%Y%m%d-%H%M).db"
# Or via backup command:
sqlite3 data/app.db "VACUUM INTO 'data/backup-$(date +%Y%m%d).db'"
```

### Option 2: Use script

```bash
./scripts/backup.sh
# Creates ./backups/hesab-YYYYMMDD-HHMM.db
```

### Option 3: Docker

```bash
docker exec hesab sqlite3 /app/data/app.db ".backup /app/data/backup.db"
docker cp hesab:/app/data/backup.db ./backups/
```

## Restore

```bash
# Stop app first
docker compose stop app

# Restore from backup
cp ./backups/hesab-20260904-1200.db ./data/app.db

# Remove WAL artifacts
rm -f ./data/app.db-wal ./data/app.db-shm

# Restart
docker compose up -d app
```

Or via script:

```bash
./scripts/restore.sh ./backups/hesab-20260904-1200.db
```

## Migrations

We use Prisma:

- Development: `npx prisma migrate dev --name <name>`
- Production (Docker): `npx prisma migrate deploy` (runs automatically on container start)

Never manually alter production SQLite tables without a migration — schema is version-controlled in `prisma/migrations/`.

## Where lives what?

```
Host:   ./data/app.db  (persistent volume)
Container: /app/data/app.db
Prisma schema: /app/prisma/schema.prisma
Migrations: /app/prisma/migrations/
Symlink: /app/prisma/data -> /app/data  (so both relative paths resolve)
```

## VPS Host Deployment

See `README.md` and `DEPLOY.md` for full VPS instructions.
