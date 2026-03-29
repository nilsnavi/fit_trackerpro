# Deployment Guide

Production deployment guide aligned with current repository and workflows. Краткий runbook: `README-DEPLOYMENT.md`.

## Deployment modes

- **Recommended:** GitHub Actions `.github/workflows/deploy.yml` (GitHub Release **published** or **workflow_dispatch**)
- **Manual:** SSH + `docker-compose.prod.yml` (same steps as the remote portion of `deploy.yml`)

**Deploy directory on the server** (hardcoded in `deploy.yml` as `DEPLOY_DIR`): `~/fittracker-pro`. Use this path for bootstrap, SSL paths, and manual commands.

## Prerequisites

- Ubuntu 22.04+ server with Docker and Docker Compose
- Domain with DNS A record to server IP
- SSL certificate (Let's Encrypt)
- SSH key access from GitHub Actions runner

## Server Bootstrap

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y nginx certbot python3-certbot-nginx
```

```bash
mkdir -p ~/fittracker-pro/backups ~/fittracker-pro/nginx ~/fittracker-pro/nginx/ssl ~/fittracker-pro/nginx/logs
```

## Root `.env` for production compose

```env
POSTGRES_USER=fittracker
POSTGRES_PASSWORD=change_me
POSTGRES_DB=fittracker

SECRET_KEY=change_me
TELEGRAM_BOT_TOKEN=change_me
TELEGRAM_WEBAPP_URL=https://fit.example.com
ALLOWED_ORIGINS=https://fit.example.com
SENTRY_DSN=

VITE_API_URL=https://fit.example.com/api/v1
VITE_TELEGRAM_BOT_USERNAME=fit_tracker_bot

GITHUB_REPOSITORY=your-org/fit_trackerpro
# Версионированный тег из GHCR (semver релиза или main-<sha>), не latest
IMAGE_TAG=v1.0.0
```

`docker-compose.prod.yml` требует непустой `IMAGE_TAG`; базовые образы (Postgres, Redis, Nginx) в файле закреплены по digest.

## GitHub Secrets (required by workflows)

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `SSH_PRIVATE_KEY`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBAPP_URL`
- `ALLOWED_ORIGINS`
- `SENTRY_DSN` (optional)
- `VITE_API_URL`
- `VITE_TELEGRAM_BOT_USERNAME`
- `SLACK_WEBHOOK_URL` (optional)

## SSL and Nginx

1. Issue certificate:

```bash
sudo certbot certonly --standalone -d fit.example.com
```

2. Place certs where production compose expects them:

```bash
mkdir -p ~/fittracker-pro/nginx/ssl
sudo cp /etc/letsencrypt/live/fit.example.com/fullchain.pem ~/fittracker-pro/nginx/ssl/
sudo cp /etc/letsencrypt/live/fit.example.com/privkey.pem ~/fittracker-pro/nginx/ssl/
sudo chown -R $USER:$USER ~/fittracker-pro/nginx/ssl
```

## Manual deploy

```bash
mkdir -p ~/fittracker-pro/nginx
scp docker-compose.prod.yml <user>@<host>:~/fittracker-pro/docker-compose.prod.yml
scp nginx/nginx.conf <user>@<host>:~/fittracker-pro/nginx/nginx.conf
ssh <user>@<host>
cd ~/fittracker-pro
# Ensure root .env exists with the same variables as GitHub Secrets (see above)
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker-compose -f docker-compose.prod.yml up -d
```

## Automated deploy (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`. Image builds: `.github/workflows/build.yml` (GHCR).

1. SSH to `DEPLOY_HOST` as `DEPLOY_USER` (key from `SSH_PRIVATE_KEY`)
2. Sync `docker-compose.prod.yml` and `nginx/nginx.conf` to `~/fittracker-pro`
3. Rewrite root `~/fittracker-pro/.env` from secrets (including `IMAGE_TAG` from the release tag, or from the required `workflow_dispatch` input `image_tag` — must not be empty or `latest`)
4. Write `~/fittracker-pro/.rollback-meta.env` (previous tag, backup path, etc.)
5. `pg_dump` to `backups/` before migration
6. `docker-compose pull`, `run --rm backend alembic upgrade head`, `up -d`, `docker image prune -f`
7. On-server checks: `http://localhost:8000/api/v1/system/health`, `/api/v1/system/version`, `http://localhost/`
8. **Post-deploy smoke** job (from the runner): uses `VITE_API_URL` to hit public API URLs with retries
9. **Rollback on failure** if deploy or smoke failed: restore `IMAGE_TAG` to `PREVIOUS_IMAGE_TAG` (only if a previous tag was recorded before deploy; first deploy on a clean server has no previous tag), `pull` backend/frontend, `up -d`; optional DB restore only when manual run sets `rollback_restore_db=true`
10. **Notify**: Slack if `SLACK_WEBHOOK_URL` is set

The **Environment** dropdown on `workflow_dispatch` (production / staging) is not referenced in the workflow YAML today; the target remains `DEPLOY_HOST` + `~/fittracker-pro`.

## Verification

```bash
curl -f https://fit.example.com/api/v1/system/health
curl -f https://fit.example.com/api/v1/system/version
cd ~/fittracker-pro
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Rollback

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s/^IMAGE_TAG=.*/IMAGE_TAG=${PREVIOUS_IMAGE_TAG}/" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

By default, keep DB as-is. Restore DB from backup only for migration-related incidents.

For the current P1-safe rollback workflow (previous image tag pinning, optional DB restore, and post-rollback health checks), see `docs/ROLLBACK_STRATEGY.md`.
