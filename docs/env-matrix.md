# Матрица env-переменных FitTracker Pro

Документ фиксирует **текущий** набор переменных окружения, обнаруженный в `frontend`, `backend`, `docker-compose`, `workflows`, `nginx`, `monitoring`.

## 1) Runtime переменные приложения (frontend + backend + compose)

| Переменная | Зона | Где используется | Значение по умолчанию / пример | Обязательность |
|---|---|---|---|---|
| `APP_NAME` | backend | `backend/.env.example`, `backend/app/settings/config.py` | `FitTracker Pro` | опционально |
| `ENVIRONMENT` | backend | `backend/.env.example`, `backend/.env.production.example`, `backend/app/settings/config.py`, `docker-compose*.yml` | `development` / `production` | обязательно для prod |
| `DEBUG` | backend | `backend/.env.example`, `backend/.env.production.example`, `backend/app/settings/config.py`, `docker-compose*.yml` | `true` / `false` | обязательно для prod (`false`) |
| `DATABASE_URL` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/migrate.yml` | `postgresql+asyncpg://...` | обязательно |
| `DATABASE_URL_SYNC` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/migrate.yml` | `postgresql://...` | опционально (но фактически используется) |
| `REDIS_URL` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml` | `redis://localhost:6379/0` / `redis://redis:6379/0` | опционально (есть fallback) |
| `ANALYTICS_CACHE_ENABLED` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `true` | опционально |
| `ANALYTICS_CACHE_TTL_SECONDS` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `120` | опционально |
| `ANALYTICS_MEMORY_CACHE_ENABLED` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `true` | опционально |
| `ANALYTICS_MEMORY_CACHE_TTL_SECONDS` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `20` | опционально |
| `ANALYTICS_DEFAULT_MAX_EXERCISES` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `30` | опционально |
| `ANALYTICS_MAX_EXERCISES_HARD_LIMIT` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `100` | опционально |
| `ANALYTICS_DEFAULT_MAX_DATA_POINTS` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `120` | опционально |
| `ANALYTICS_MAX_DATA_POINTS_HARD_LIMIT` | backend | `backend/.env*.example`, `backend/app/settings/config.py` | `365` | опционально |
| `TELEGRAM_BOT_TOKEN` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/deploy-environment.yml` | `your_bot_token_here` | обязательно для Telegram-функций |
| `TELEGRAM_WEBAPP_URL` | backend/frontend bridge | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/deploy-environment.yml` | `https://fittrackpro.ru` (prod) | обязательно в prod |
| `SECRET_KEY` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/deploy-environment.yml` | `your_secret_key_here...` | обязательно |
| `ALGORITHM` | backend | `backend/.env.example`, `backend/app/settings/config.py` | `HS256` | опционально |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | backend | `backend/.env.example`, `backend/app/settings/config.py` | `30` | опционально |
| `ALLOWED_ORIGINS` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/deploy-environment.yml` | `http://localhost:3000,...` | обязательно в prod (не `*`) |
| `SENTRY_DSN` | backend/frontend | `backend/.env*.example`, `docker-compose*.yml`, `.github/workflows/deploy-environment.yml` | пусто | опционально |
| `SENTRY_ENVIRONMENT` | frontend runtime | `backend/.env.production.example`, `frontend/.env.example`, `docker-compose.prod.yml` | `production` | опционально |
| `SENTRY_RELEASE` | backend/frontend runtime | `backend/.env.production.example`, `frontend/.env.example`, `docker-compose.prod.yml` | пусто / commit SHA | опционально |
| `SENTRY_DIST` | frontend runtime | `backend/.env.production.example`, `frontend/.env.example`, `docker-compose.prod.yml` | пусто | опционально |
| `API_URL` | frontend runtime / CI bridge | `backend/.env.production.example`, `frontend/.env.example`, `docker-compose.prod.yml`, `.github/workflows/deploy-environment.yml` | `https://fittrackpro.ru/api/v1` | обязательно для prod runtime config |
| `VITE_API_URL` | frontend | `frontend/.env.example`, `frontend/src/vite-env.d.ts`, `frontend/src/shared/config/runtime.ts`, `docker-compose*.yml`, `.github/workflows/deploy-environment.yml` | `http://localhost:8000/api/v1`; prod: `https://fittrackpro.ru/api/v1` | обязательно для frontend |
| `VITE_TELEGRAM_BOT_USERNAME` | frontend | `frontend/.env.example`, `frontend/src/vite-env.d.ts`, `docker-compose*.yml`, `.github/workflows/deploy-environment.yml` | `your_bot_username` | обязательно для Telegram Mini App |
| `VITE_TELEGRAM_WEBAPP_URL` | frontend | `frontend/.env.example`, `frontend/src/vite-env.d.ts` | `https://fittrackpro.ru` | опционально |
| `VITE_ENVIRONMENT` | frontend | `frontend/.env.example`, `docker-compose*.yml` | `development` / `production` | опционально |
| `VITE_SENTRY_DSN` | frontend | `frontend/.env.example` | пусто | опционально |
| `VITE_SENTRY_RELEASE` | frontend | `frontend/.env.example`, `frontend/src/shared/config/runtime.ts` | пусто / commit SHA | опционально |
| `VITE_ENABLE_ANALYTICS` | frontend | `frontend/.env.example` | `false` | опционально |
| `VITE_ENABLE_DEBUG_TOOLS` | frontend | `frontend/.env.example` | `true` | опционально |
| `POSTGRES_USER` | infrastructure | `docker-compose*.yml`, `backend/.env.production.example`, `.github/workflows/test.yml`, `.github/workflows/deploy-environment.yml`, `.github/workflows/migrate.yml` | `fittracker` / `test` | обязательно |
| `POSTGRES_PASSWORD` | infrastructure | `docker-compose*.yml`, `backend/.env.production.example`, `.github/workflows/test.yml`, `.github/workflows/deploy-environment.yml` | `fittracker_password` / `test` | обязательно |
| `POSTGRES_DB` | infrastructure | `docker-compose*.yml`, `backend/.env.production.example`, `.github/workflows/test.yml`, `.github/workflows/deploy-environment.yml`, `.github/workflows/migrate.yml` | `fittracker` / `test` | обязательно |
| `GITHUB_REPOSITORY` | infrastructure/CI | `docker-compose.prod.yml`, `backend/.env.production.example`, `.github/workflows/deploy-environment.yml` | `owner/repo` | обязательно для prod-образов |
| `IMAGE_TAG` | infrastructure/CI | `docker-compose.prod.yml`, `backend/.env.production.example`, `.github/workflows/deploy.yml`, `.github/workflows/deploy-environment.yml` | `v1.0.0` / `main-<sha>` | обязательно, не `latest` |
| `TELEGRAM_BOT_USERNAME` | frontend runtime / CI bridge | `backend/.env.production.example`, `frontend/.env.example`, `docker-compose.prod.yml`, `.github/workflows/deploy-environment.yml` | `your_bot_username` | обязательно для Telegram Mini App |
| `NGINX_SSL_DIR` | infrastructure | `docker-compose.prod.yml`, `backend/.env.production.example`, `docs/DEPLOYMENT.md` | `/etc/fittracker-pro/nginx/ssl` | обязательно на prod-хосте; может быть вне repo |
| `BACKUPS_DIR` | infrastructure | `docker-compose.prod.yml`, `backend/.env.production.example`, `docs/DEPLOYMENT.md` | `/var/backups/fittracker-pro` | рекомендуется/обязательно для backup-процедуры; может быть вне repo |

## 2) Backend .env-шаблон: переменные, которые пока не видны в `Settings`

Эти переменные присутствуют в `backend/.env.example`, но в текущем `backend/app/settings/config.py` не объявлены:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_TLS`
- `UPLOAD_DIR`
- `MAX_UPLOAD_SIZE`
- `RATE_LIMIT_PER_MINUTE`
- `LOG_LEVEL`
- `LOG_FORMAT`

## 3) Monitoring (Prometheus/Grafana/Loki/Promtail)

| Переменная | Где используется | Значение по умолчанию / пример | Обязательность |
|---|---|---|---|
| `GRAFANA_ADMIN_USER` | `monitoring/docker-compose.monitoring.yml` | `admin` (через `${GRAFANA_ADMIN_USER:-admin}`) | желательно задать в prod |
| `GRAFANA_ADMIN_PASSWORD` | `monitoring/docker-compose.monitoring.yml` | `admin` (через `${GRAFANA_ADMIN_PASSWORD:-admin}`) | обязательно сменить в prod |
| `GF_USERS_ALLOW_SIGN_UP` | `monitoring/docker-compose.monitoring.yml` | `false` (inline) | фиксированно |
| `GF_SERVER_ROOT_URL` | `monitoring/docker-compose.monitoring.yml` | `https://grafana.yourdomain.com` (inline) | зависит от домена |
| `GF_INSTALL_PLUGINS` | `monitoring/docker-compose.monitoring.yml` | `grafana-clock-panel,grafana-simple-json-datasource` (inline) | опционально |

## 4) GitHub Actions / Workflows

### 4.1 Workflow env (обычные переменные)

| Переменная | Workflow | Значение / источник |
|---|---|---|
| `REGISTRY` | `build.yml`, `deploy.yml` | `ghcr.io` |
| `IMAGE_NAME_BACKEND` | `build.yml` | `${{ github.repository }}/backend` |
| `IMAGE_NAME_FRONTEND` | `build.yml` | `${{ github.repository }}/frontend` |
| `NODE_VERSION` | `test.yml` | `20` |
| `PYTHON_VERSION` | `test.yml` | `3.11` |
| `DEPLOY_HOST` | `deploy-environment.yml` | `${{ secrets.DEPLOY_HOST }}` |
| `DEPLOY_USER` | `deploy-environment.yml` | `${{ secrets.DEPLOY_USER }}` |

### 4.2 Workflow secrets (`deploy.yml` + `deploy-environment.yml`)

- `SSH_PRIVATE_KEY`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBAPP_URL`
- `ALLOWED_ORIGINS`
- `VITE_API_URL`
- `VITE_TELEGRAM_BOT_USERNAME`

Опциональные:

- `SENTRY_DSN`
- `SLACK_WEBHOOK_URL`

`GITHUB_TOKEN` предоставляется GitHub Actions автоматически. `DATABASE_URL` и `DATABASE_URL_SYNC` не используются текущим deploy DAG; production compose строит URL из `POSTGRES_*`.

## 5) Nginx

В `nginx/nginx.conf` переменные окружения формата `${VAR}` **не используются**.  
Используются только встроенные runtime-переменные Nginx (`$host`, `$remote_addr`, `$request_uri`, и т.д.), это не `.env` проекта.

## 6) Где править значения в первую очередь

- Локальная разработка: `backend/.env` и `frontend/.env` (на базе `*.example`)
- Docker dev: корневой `.env` для `docker-compose.yml`
- Docker prod: корневой `.env` для `docker-compose.prod.yml`
- CI/CD: GitHub Actions Secrets/Variables
- Monitoring: `.env` рядом с `monitoring/docker-compose.monitoring.yml` (для `GRAFANA_ADMIN_*`)

## 7) Автоматическая проверка консистентности

Добавлен unit-тест `backend/app/tests/test_env_consistency.py`:

- сравнивает ключи из `backend/.env.example` и поля `Settings` (`backend/app/settings/config.py`);
- падает, если ключ есть в шаблоне, но отсутствует в `Settings`;
- падает, если поле есть в `Settings`, но отсутствует в шаблоне.

Для production/server `.env` добавлен отдельный валидатор:

```bash
node scripts/validate-production-env.mjs .env
```

Он проверяет обязательность и формат `IMAGE_TAG`, `POSTGRES_*`, `SECRET_KEY`, `TELEGRAM_*`, `ALLOWED_ORIGINS`, `API_URL`, `VITE_API_URL`, `NGINX_SSL_DIR`, `BACKUPS_DIR` без вывода значений.
