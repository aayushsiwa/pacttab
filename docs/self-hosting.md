# Self-Hosting PactTab

PactTab is designed to be easily self-hostable on any Linux VPS, homelab, Raspberry Pi, or cloud provider (Hetzner, DigitalOcean, AWS, Coolify, Dokku, Portainer).

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    Your Server / VPS                       │
│                                                            │
│   ┌────────────────────────────────────────────────────┐   │
│   │ Reverse Proxy (Caddy / Nginx / Cloudflare Tunnel)  │   │
│   │ Public HTTPS :443 ──> /api/ws (Upgrade) & HTTP     │   │
│   └─────────────────────────┬──────────────────────────┘   │
│                             │ :3000                        │
│                             ▼                              │
│   ┌────────────────────────────────────────────────────┐   │
│   │ pacttab_app (Next.js + WebSocket Hub)              │   │
│   │   - Auto migrations on boot                        │   │
│   │   - Healthcheck: /api/health                       │   │
│   └───────────────┬────────────────────────┬───────────┘   │
│                   │ :5432                  │ :6379         │
│                   ▼                        ▼               │
│   ┌────────────────────────┐   ┌───────────────────────┐   │
│   │ pacttab_db (PostgreSQL)│   │ pacttab_redis (Redis) │   │
│   │ Volume: postgres_data  │   │ Volume: redis_data    │   │
│   └────────────────────────┘   └───────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## 1. Quickstart with Docker Compose (Recommended)

### Prerequisites

- Docker Engine 24+ and Docker Compose v2+
- Git

### Step 1: Clone the repository

```bash
git clone https://github.com/aayushsiwa/pacttab.git
cd pacttab
```

### Step 2: Configure environment variables

Copy the example environment file and customize your domain and secrets:

```bash
cp .env.example .env
```

Generate secure random secrets:

```bash
openssl rand -base64 32
```

Update `.env` with:

- `SESSION_SECRET`: Random 32+ character key.
- `BETTER_AUTH_SECRET`: Random 32+ character key.
- `BETTER_AUTH_URL`: Your public domain (e.g., `https://pacttab.yourdomain.com`).
- `NEXT_PUBLIC_APP_URL`: Your public domain (e.g., `https://pacttab.yourdomain.com`).

### Step 3: Start the stack

```bash
docker compose up -d
```

PactTab will:

1. Spin up PostgreSQL 16 and Redis 7 with automatic health checks.
2. Build the multi-stage Next.js production container.
3. Automatically execute all database migrations via `docker-entrypoint.sh`.
4. Start the application on `http://localhost:3000`.

### Step 4: Verify health

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-09-11T12:00:00.000Z",
  "responseTimeMs": 4,
  "services": {
    "database": "connected",
    "redis": "connected",
    "websocket": "ready"
  }
}
```

---

## 2. Low-Resource / Lite Mode (No Redis)

If you are running on a 512MB RAM VPS or Raspberry Pi, you can omit Redis entirely. PactTab includes an automatic in-memory WebSocket event bus fallback.

Run using the lite compose profile:

```bash
docker compose -f docker-compose.lite.yml up -d
```

This runs only PostgreSQL and the PactTab app container, consuming under 120MB of total system RAM.

---

## 3. Reverse Proxy & SSL Configuration

Because PactTab relies on WebSockets (`/api/ws`) for instant chat, message notifications, and balance recalculations, your reverse proxy must forward WebSocket upgrade headers.

### Option A: Caddy (Easiest — Automatic HTTPS)

Install Caddy and use the included configuration from [`deploy/caddy/Caddyfile`](../deploy/caddy/Caddyfile):

```caddy
pacttab.yourdomain.com {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

Caddy handles Let's Encrypt certificates and WebSocket connection upgrades automatically.

### Option B: Nginx

Use the provided site configuration template from [`deploy/nginx/pacttab.conf`](../deploy/nginx/pacttab.conf):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name pacttab.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pacttab.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pacttab.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pacttab.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### Option C: Cloudflare Tunnel

If using Cloudflare Tunnels (Zero Trust):

1. Create a tunnel pointing to `http://localhost:3000`.
2. Ensure **WebSockets** is toggled **ON** in your Cloudflare dashboard under _Network_ settings.

---

## 4. Backups and Restoration

PactTab stores all persistent state in PostgreSQL.

### Create a Database Backup

```bash
docker exec -t pacttab_db pg_dump -U pacttab pacttab > "pacttab_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Restore from Backup

```bash
docker exec -i pacttab_db psql -U pacttab -d pacttab < backup.sql
```

---

## 5. Updating to New Versions

To update an existing installation without data loss:

```bash
# 1. Pull latest code
git pull origin master

# 2. Rebuild container and restart
docker compose build --pull
docker compose up -d

# 3. Prune old images
docker image prune -f
```

Database migrations run automatically during container startup.

---

## 6. Bare-Metal VPS Setup (Without Docker)

If you prefer to host directly on Ubuntu/Debian using systemd:

1. **Install Node.js 20+ and pnpm**:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   corepack enable && corepack prepare pnpm@latest --activate
   ```

2. **Install PostgreSQL and Redis**:

   ```bash
   sudo apt-get install -y postgresql redis-server
   sudo systemctl enable --now postgresql redis-server
   ```

3. **Setup Database**:

   ```bash
   sudo -u postgres psql -c "CREATE USER pacttab WITH PASSWORD 'your_password';"
   sudo -u postgres psql -c "CREATE DATABASE pacttab OWNER pacttab;"
   ```

4. **Clone and Build**:

   ```bash
   sudo git clone https://github.com/aayushsiwa/pacttab.git /opt/pacttab
   cd /opt/pacttab
   sudo pnpm install --frozen-lockfile
   sudo pnpm run build
   sudo pnpm run db:init
   ```

5. **Install Systemd Service**:
   ```bash
   sudo cp deploy/systemd/pacttab.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now pacttab
   ```

---

## 7. Troubleshooting

| Symptom                                         | Probable Cause                          | Resolution                                                                                                           |
| :---------------------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `/api/health` returns `503 Service Unavailable` | PostgreSQL or Redis is unreachable      | Check `docker compose logs db` or ensure `DATABASE_URL` matches credentials.                                         |
| Group chat messages don't appear in real time   | WebSocket connection dropped or blocked | Verify reverse proxy passes `Upgrade` and `Connection` headers. Check browser console for `ws://` / `wss://` errors. |
| Redirect loops on login                         | Mismatched `BETTER_AUTH_URL`            | Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to match your exact public domain with protocol (`https://...`).     |
| Container fails with migration error            | Database user lacks permissions         | Ensure the user has `CREATE TABLE`, `ALTER TABLE`, and schema modification rights.                                   |
