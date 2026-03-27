# Environment Setup

This guide mirrors the current `.env.example` files and deployment flow.

## Quick Start

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then edit values for your environment.

## Backend Variables (`backend/.env`)

### Required

- `DATABASE_URL` (async SQLAlchemy URL)
- `DATABASE_URL_SYNC` (sync URL for Alembic/tools)
- `SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBAPP_URL`

### Common (recommended)

- `ENVIRONMENT` (`development`/`test`/`production`)
- `DEBUG` (`true` or `false`)
- `ALLOWED_ORIGINS` (comma-separated)
- `REDIS_URL`
- `RATE_LIMIT_PER_MINUTE`
- `LOG_LEVEL`

### Analytics flags

- `ANALYTICS_CACHE_ENABLED`
- `ANALYTICS_CACHE_TTL_SECONDS`
- `ANALYTICS_MEMORY_CACHE_ENABLED`
- `ANALYTICS_MEMORY_CACHE_TTL_SECONDS`
- `ANALYTICS_DEFAULT_MAX_EXERCISES`
- `ANALYTICS_MAX_EXERCISES_HARD_LIMIT`
- `ANALYTICS_DEFAULT_MAX_DATA_POINTS`
- `ANALYTICS_MAX_DATA_POINTS_HARD_LIMIT`

## Frontend Variables (`frontend/.env`)

### Required

- `VITE_API_URL` (for example `http://localhost:8000/api/v1`)
- `VITE_TELEGRAM_BOT_USERNAME`

### Optional

- `VITE_ENVIRONMENT`
- `VITE_SENTRY_DSN`
- `VITE_ENABLE_ANALYTICS`
- `VITE_ENABLE_DEBUG_TOOLS`

## Production Compose Variables (root `.env`)

Used by `docker-compose.prod.yml` and GitHub `deploy.yml`:

- DB: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Backend: `SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`, `ALLOWED_ORIGINS`, `SENTRY_DSN`
- Frontend: `VITE_API_URL`, `VITE_TELEGRAM_BOT_USERNAME`
- Registry metadata: `GITHUB_REPOSITORY`

## Secret Generation

```bash
openssl rand -hex 32
```

PowerShell:

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```

## Validation Checklist

- `.env` files are not committed
- production `DEBUG=false`
- `ALLOWED_ORIGINS` contains only trusted domains
- production `TELEGRAM_WEBAPP_URL` is HTTPS
