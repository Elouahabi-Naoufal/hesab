# Hesab — Group Expense & Settlement

> **Who should pay whom, and how much?**

A production-quality, mobile-first web app for managing shared expenses between friends during pool, restaurants, trips, gaming, etc. Handles different participants per activity, contributions vs actual payments, and automatic debt simplification.

Built with **Next.js 16 • Prisma • SQLite (WAL) • Tailwind • Zod • Docker**.

---

## Quick Start (Local)

```bash
git clone <repo>
cd expense-app
cp .env.example .env
# Edit JWT_SECRET: openssl rand -base64 32

npm install
npx prisma migrate dev
npx prisma generate
npm run dev
# http://localhost:3000
```

Create 4 users (Naoufal, Mohamed, Yassine, Anour), then follow the demo flow in the spec.

---

## VPS Deployment (Docker)

Recommended: Ubuntu/Debian VPS with Docker + Docker Compose.

```bash
# 1. On VPS, clone and configure
git clone <repo> /opt/hesab
cd /opt/hesab
cp .env.example .env
nano .env # set JWT_SECRET, DATABASE_URL=file:/app/data/app.db, NEXT_PUBLIC_APP_URL=https://your-domain.com

# 2. Build & run (persistent SQLite)
mkdir -p data
docker compose up --build -d

# 3. Check logs
docker compose logs -f app
docker compose ps
# App on http://YOUR_VPS_IP:3000
```

**Persistent volume:** `./data:/app/data` — database survives restarts and `docker compose down`.

**Caddy / Nginx reverse proxy (optional):**

```nginx
server {
  server_name hesab.yourdomain.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
  }
}
```

### Environment

```
DATABASE_URL=file:/app/data/app.db   # Docker absolute
JWT_SECRET=long-random-32+chars
NEXT_PUBLIC_APP_URL=https://hesab.yourdomain.com
PORT=3000
```

### Migrations

Automatically run on container start via `docker-entrypoint.sh`:

```
npx prisma migrate deploy
PRAGMA journal_mode=WAL
```

Manual:

```bash
docker exec hesab npx prisma migrate deploy
```

### Backups

See `BACKUP.md`:

```bash
./scripts/backup.sh
./scripts/restore.sh ./backups/hesab-YYYYMMDD-HHMM.db
```

---

## Core Concepts

- **SQLite primary** (`./data/app.db` on WAL mode), mounted persistently. No Postgres needed. Domain layer abstracted via Prisma for future migration.
- **Money:** integer `centimes` (100 DH = 10000). No floats. Deterministic rounding.
- **Allocation modes:** EQUAL, PERCENTAGE (basis points 10000), CUSTOM_AMOUNT, PORTIONS.
- **Settlement:** `net = paid - responsibility`, greedy debt simplification, integer only.

### Required Financial Tests

Two exact spec tests in `src/domain/__tests__/settlement.test.ts` plus additional invariants.

---

## Project Structure

```
src/
  app/            # Next.js App Router (page, layout, middleware)
  components/
  domain/         # Pure settlement + money (no framework)
    money.ts
    settlement.ts
    allocation.ts
  lib/            # prisma, utils
  server/         # auth, groups, activities, expenses, settlement
  prisma/
    schema.prisma
    migrations/
Dockerfile
docker-compose.yml
scripts/backup.sh / restore.sh
```

---

## Tech Stack

Next.js 16, React 19, TypeScript, Tailwind 4, Prisma 5, SQLite, Zod, bcryptjs, jose, nanoid.

---

## License

MIT
