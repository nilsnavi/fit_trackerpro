# Deployment Guide

Production deployment guide aligned with current repository and workflows.

## Deployment Modes

- **Recommended:** GitHub Actions `deploy.yml` (release or manual dispatch)
- **Manual:** SSH + `docker-compose.prod.yml`

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
sudo apt install -y git nginx certbot python3-certbot-nginx
```

```bash
mkdir -p ~/fit_trackerpro/backups
cd ~/fit_trackerpro
git clone https://github.com/nilsnavi/fit_trackerpro.git .
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

GITHUB_REPOSITORY=nilsnavi/fit_trackerpro
```

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
mkdir -p ~/fit_trackerpro/nginx/ssl
sudo cp /etc/letsencrypt/live/fit.example.com/fullchain.pem ~/fit_trackerpro/nginx/ssl/
sudo cp /etc/letsencrypt/live/fit.example.com/privkey.pem ~/fit_trackerpro/nginx/ssl/
sudo chown -R $USER:$USER ~/fit_trackerpro/nginx/ssl
```

## Manual Deploy

```bash
cd ~/fit_trackerpro
git pull
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker-compose -f docker-compose.prod.yml up -d
```

## Automated Deploy (GitHub Actions)

The current `deploy.yml` workflow:

1. Connects via SSH
2. Updates code on server
3. Regenerates root `.env` from GitHub secrets
4. Creates DB backup
5. Pulls images and applies migrations
6. Restarts stack
7. Runs backend health checks (`/api/v1/system/health`, `/api/v1/system/version`)

## Verification

```bash
curl -f https://fit.example.com/api/v1/system/health
curl -f https://fit.example.com/api/v1/system/version
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Rollback

```bash
cd ~/fit_trackerpro
docker-compose -f docker-compose.prod.yml down
# restore DB backup if needed
docker-compose -f docker-compose.prod.yml up -d
```

Use the latest backup in `~/fit_trackerpro/backups`.
