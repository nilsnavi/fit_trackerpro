# Production Checklist

Checklist for releasing current FitTracker Pro stack.

## 1) Before release

- [ ] `README.md` and docs in `docs/` are updated
- [ ] Frontend: `npm run lint`, `npm run test:ci`, `npm run build`
- [ ] Backend: `pytest`
- [ ] No critical/high vulnerabilities in dependency scan
- [ ] Release tag/version prepared

## 2) Environment and secrets

- [ ] Server has root project folder `~/fittracker-pro`
- [ ] Root `.env` exists with production values
- [ ] Root `.env` is not committed to git; only `*.example` files are tracked
- [ ] `node scripts/validate-production-env.mjs .env` passes on the server/operator copy
- [ ] GitHub secrets configured (deploy + migrations)
- [ ] `SECRET_KEY` rotated/strong
- [ ] `ALLOWED_ORIGINS` restricted to production domains
- [ ] `API_URL` and `VITE_API_URL` include `/api/v1`
- [ ] Telegram bot and Mini App URL configured in BotFather

## 3) Infrastructure

- [ ] Docker and Docker Compose installed
- [ ] SSL certificate issued; `NGINX_SSL_DIR` points to the host certificate directory
- [ ] Firewall allows only 22/80/443
- [ ] DB backups directory created; `BACKUPS_DIR` points to the host backup directory

## 4) Deploy

- [ ] Run deploy via `deploy.yml` (release or manual dispatch), or manual compose deploy
- [ ] Apply migrations (`alembic upgrade head`)
- [ ] Confirm all containers are healthy

## 5) Smoke checks

- [ ] `GET /api/v1/system/health` returns 200
- [ ] `GET /api/v1/system/version` returns 200
- [ ] Telegram login works (`POST /api/v1/users/auth/telegram`)
- [ ] `GET /api/v1/users/auth/me` works with access token
- [ ] Core user flow works: workouts, health, analytics

## API prefix migration note

- [ ] Clients use standardized prefixes (`users`, `workouts`, `exercises`, `analytics`, `health-metrics`, `system`)
- [ ] No production clients depend on legacy aliases (`/api/v1/auth`, `/api/v1/achievements`, `/api/v1/challenges`, `/api/v1/emergency`)
- [ ] Legacy aliases removal is scheduled for `v1.2.0` (`2026-06-30`)

## 6) Post-deploy

- [ ] Check backend logs for startup/runtime errors
- [ ] Check frontend in Telegram Mini App context
- [ ] Verify Sentry receives errors (test event)
- [ ] Verify backup job and restore instructions

## 7) Rollback readiness

- [ ] Latest DB backup available
- [ ] Last stable release/commit identified
- [ ] Rollback steps tested at least once in staging

## 8) Required GitHub secrets

- [ ] `DEPLOY_HOST`
- [ ] `DEPLOY_USER`
- [ ] `SSH_PRIVATE_KEY`
- [ ] `POSTGRES_USER`
- [ ] `POSTGRES_PASSWORD`
- [ ] `POSTGRES_DB`
- [ ] `SECRET_KEY`
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `TELEGRAM_WEBAPP_URL`
- [ ] `ALLOWED_ORIGINS`
- [ ] `VITE_API_URL`
- [ ] `VITE_TELEGRAM_BOT_USERNAME`

## 9) Optional GitHub secrets

- [ ] `SENTRY_DSN` (optional error tracking; empty is allowed)
- [ ] `SLACK_WEBHOOK_URL` (optional deploy notifications; empty disables Slack notification delivery)

## 10) Production `.env` keys for manual/server deploy

- [ ] `IMAGE_TAG` is set to a versioned tag and is not `latest`
- [ ] `GITHUB_REPOSITORY` matches the GHCR repository owner/name
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are set
- [ ] `SECRET_KEY` is at least 32 characters
- [ ] `TELEGRAM_BOT_TOKEN` is set
- [ ] `TELEGRAM_WEBAPP_URL` is HTTPS
- [ ] `ALLOWED_ORIGINS` contains only HTTPS origins and no `*`
- [ ] `API_URL` and `VITE_API_URL` include `/api/v1`
- [ ] `TELEGRAM_BOT_USERNAME` is set for frontend runtime config
- [ ] `NGINX_SSL_DIR` and `BACKUPS_DIR` point to host directories outside the repository when running production
