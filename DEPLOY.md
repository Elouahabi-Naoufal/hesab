# VPS Deploy Guide — Hesab

Tested on Ubuntu 22.04 / Debian 12 with Docker Engine + Compose plugin.

## 1. Provision VPS

```bash
# On VPS as root
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git sqlite3 ufw
systemctl enable --now docker
ufw allow 22,80,443/tcp
ufw enable
```

## 2. Clone & Configure

```bash
git clone <your-repo-url> /opt/hesab
cd /opt/hesab
cp .env.example .env
# Generate secret
openssl rand -base64 32
# Edit .env:
# DATABASE_URL=file:/app/data/app.db
# JWT_SECRET=<paste>
# NEXT_PUBLIC_APP_URL=https://hesab.yourdomain.com  (or http://IP:3000)
nano .env
```

## 3. Build & Run

```bash
mkdir -p data
# Set correct permissions (container runs as nextjs 1001)
chown 1001:1001 data

docker compose up --build -d
docker compose logs -f app
# Wait for "Ready on http://0.0.0.0:3000" and "WAL mode"
```

Check:

```bash
docker compose ps
curl -I http://localhost:3000
ls -lh data/  # should have app.db
sqlite3 data/app.db "PRAGMA journal_mode;" # expect wal
```

## 4. Reverse Proxy + TLS (Caddy example)

```bash
apt install -y caddy
# /etc/caddy/Caddyfile
# hesab.yourdomain.com {
#   reverse_proxy localhost:3000
# }
systemctl reload caddy
```

Or Nginx + Certbot.

## 5. Updates

```bash
cd /opt/hesab
git pull
docker compose up --build -d
# Migrations run automatically
```

## 6. Backups (Cron)

```bash
# /etc/cron.d/hesab-backup
0 3 * * * root /opt/hesab/scripts/backup.sh >> /var/log/hesab-backup.log 2>&1
# Keep 7 days
0 4 * * * root find /opt/hesab/backups -mtime +7 -delete
```

Restore:

```bash
/opt/hesab/scripts/restore.sh /opt/hesab/backups/hesab-20260904-0300.db
```

## 7. Monitoring

```bash
docker stats hesab
docker compose logs --tail 50 -f
# Healthcheck hits http://localhost:3000/
```

## 8. Troubleshooting

- **DB locked:** Ensure WAL mode: `sqlite3 data/app.db "PRAGMA journal_mode=WAL;"`
- **Permission denied on data:** `chown -R 1001:1001 data`
- **Migrations not applied:** `docker exec hesab npx prisma migrate deploy`
- **Port in use:** change `docker-compose.yml` ports to `3001:3000`

## 9. Scaling Note

SQLite is intentionally primary. For many concurrent writes, consider:

- Keep writes short (already)
- If you outgrow SQLite, Prisma abstraction allows migrating to Postgres later without rewriting domain logic — just change `provider = "postgresql"` and update `DATABASE_URL`.

For current MVP (small groups, occasional writes), SQLite + WAL is sufficient and simplifies VPS hosting (no DB server).
