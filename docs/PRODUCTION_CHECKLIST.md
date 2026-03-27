# Production Checklist

Checklist for releasing current FitTracker Pro stack.

## 1) Before release

- [ ] `README.md` and docs in `docs/` are updated
- [ ] Frontend: `npm run lint`, `npm run test:ci`, `npm run build`
- [ ] Backend: `pytest`
- [ ] No critical/high vulnerabilities in dependency scan
- [ ] Release tag/version prepared

## 2) Environment and secrets

- [ ] Server has root project folder `~/fit_trackerpro`
- [ ] Root `.env` exists with production values
- [ ] GitHub secrets configured (deploy + migrations)
- [ ] `SECRET_KEY` rotated/strong
- [ ] `ALLOWED_ORIGINS` restricted to production domains
- [ ] Telegram bot and Mini App URL configured in BotFather

## 3) Infrastructure

- [ ] Docker and Docker Compose installed
- [ ] SSL certificate issued and copied to `nginx/ssl`
- [ ] Firewall allows only 22/80/443
- [ ] DB backups directory created (`~/fit_trackerpro/backups`)

## 4) Deploy

- [ ] Run deploy via `deploy.yml` (release or manual dispatch), or manual compose deploy
- [ ] Apply migrations (`alembic upgrade head`)
- [ ] Confirm all containers are healthy

## 5) Smoke checks

- [ ] `GET /api/v1/system/health` returns 200
- [ ] `GET /api/v1/system/version` returns 200
- [ ] Telegram login works (`POST /api/v1/auth/telegram`)
- [ ] `GET /api/v1/auth/me` works with access token
- [ ] Core user flow works: workouts, health, analytics

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
