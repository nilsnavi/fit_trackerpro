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
| `TELEGRAM_BOT_TOKEN` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/deploy.yml` | `your_bot_token_here` | обязательно для Telegram-функций |
| `TELEGRAM_WEBAPP_URL` | backend/frontend bridge | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/deploy.yml` | `https://fittrackpro.ru` (prod) | обязательно в prod |
| `SECRET_KEY` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/test.yml`, `.github/workflows/deploy.yml` | `your_secret_key_here...` | обязательно |
| `ALGORITHM` | backend | `backend/.env.example`, `backend/app/settings/config.py` | `HS256` | опционально |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | backend | `backend/.env.example`, `backend/app/settings/config.py` | `30` | опционально |
| `ALLOWED_ORIGINS` | backend | `backend/.env*.example`, `backend/app/settings/config.py`, `docker-compose*.yml`, `.github/workflows/deploy.yml` | `http://localhost:3000,...` | обязательно в prod (не `*`) |
| `SENTRY_DSN` | backend/frontend | `backend/.env*.example`, `docker-compose*.yml`, `.github/workflows/deploy.yml` | пусто | опционально |
| `VITE_API_URL` | frontend | `frontend/.env.example`, `frontend/src/vite-env.d.ts`, `frontend/src/services/api.ts`, `docker-compose*.yml`, `.github/workflows/deploy.yml` | `http://localhost:8000/api/v1`; prod: `https://fittrackpro.ru/api/v1` | обязательно для frontend |
| `VITE_TELEGRAM_BOT_USERNAME` | frontend | `frontend/.env.example`, `frontend/src/vite-env.d.ts`, `docker-compose*.yml`, `.github/workflows/deploy.yml` | `your_bot_username` | обязательно для Telegram Mini App |
| `VITE_ENVIRONMENT` | frontend | `frontend/.env.example`, `docker-compose*.yml` | `development` / `production` | опционально |
| `VITE_SENTRY_DSN` | frontend | `frontend/.env.example` | пусто | опционально |
| `VITE_ENABLE_ANALYTICS` | frontend | `frontend/.env.example` | `false` | опционально |
| `VITE_ENABLE_DEBUG_TOOLS` | frontend | `frontend/.env.example` | `true` | опционально |
| `POSTGRES_USER` | infrastructure | `docker-compose*.yml`, `backend/.env.production.example`, `.github/workflows/test.yml`, `.github/workflows/deploy.yml`, `.github/workflows/migrate.yml` | `fittracker` / `test` | обязательно |
| `POSTGRES_PASSWORD` | infrastructure | `docker-compose*.yml`, `backend/.env.production.example`, `.github/workflows/test.yml`, `.github/workflows/deploy.yml` | `fittracker_password` / `test` | обязательно |
| `POSTGRES_DB` | infrastructure | `docker-compose*.yml`, `backend/.env.production.example`, `.github/workflows/test.yml`, `.github/workflows/deploy.yml`, `.github/workflows/migrate.yml` | `fittracker` / `test` | обязательно |
| `GITHUB_REPOSITORY` | infrastructure/CI | `docker-compose.prod.yml`, `backend/.env.production.example`, `.github/workflows/deploy.yml` | `owner/repo` | обязательно для prod-образов |

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
| `DEPLOY_HOST` | `deploy.yml` | `${{ secrets.DEPLOY_HOST }}` |
| `DEPLOY_USER` | `deploy.yml` | `${{ secrets.DEPLOY_USER }}` |
| `DATABASE_URL` | `migrate.yml` | `${{ secrets.DATABASE_URL }}` |
| `DATABASE_URL_SYNC` | `migrate.yml` | `${{ secrets.DATABASE_URL_SYNC }}` |

### 4.2 Workflow secrets (используются напрямую как env/inputs)

- `GITHUB_TOKEN`
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
- `SENTRY_DSN`
- `VITE_API_URL`
- `VITE_TELEGRAM_BOT_USERNAME`
- `DATABASE_URL`
- `DATABASE_URL_SYNC`
- `SLACK_WEBHOOK_URL`

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
