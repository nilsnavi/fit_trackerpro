# FitTracker Pro

Telegram Mini App для тренировок, здоровья и аналитики.

## Quick Start (Docker)

Репозиторий: [github.com/nilsnavi/fit_trackerpro](https://github.com/nilsnavi/fit_trackerpro) (для форка используйте URL своего remote).

```bash
git clone https://github.com/nilsnavi/fit_trackerpro.git
cd fit_trackerpro

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

В `backend/.env` обязательно задайте `SECRET_KEY` (например: `openssl rand -hex 32` в Unix/macOS или `python -c "import secrets; print(secrets.token_hex(32))"`). При необходимости укажите `TELEGRAM_BOT_TOKEN` и остальные поля по комментариям в файле.

Поднять весь стек (переменные для подстановки в `docker-compose.yml` берутся из `backend/.env` и `frontend/.env`):

```bash
docker compose --env-file backend/.env --env-file frontend/.env up -d --build
docker compose --env-file backend/.env --env-file frontend/.env exec backend alembic upgrade head
```

Если у вас установлен старый бинарь, замените `docker compose` на `docker-compose`.

Доступ:

- Frontend (Nginx): `http://localhost`
- Backend API: `http://localhost:8000/api/v1`
- Swagger (при `DEBUG=true` у backend): `http://localhost:8000/docs`

## Development Setup

### Вариант A — как в Quick Start

Полный стек через Docker Compose (см. выше). Код backend смонтирован в контейнер (`./backend:/app`), правки подхватываются при перезапуске процесса внутри контейнера в зависимости от режима запуска.

### Вариант B — backend и frontend на хосте, БД в Docker

Требования: **Python 3.11+**, **Node.js 20+**, **PostgreSQL 15**, **Redis 7**.

1. Только инфраструктура:

   ```bash
   docker compose up -d postgres redis
   ```

2. Backend:

   ```bash
   cd backend
   python -m venv .venv
   # Windows: .venv\Scripts\activate
   # Unix/macOS: source .venv/bin/activate
   pip install -r requirements/dev.txt
   cp .env.example .env
   # В .env: DATABASE_* и REDIS_URL на localhost (как в .env.example), SECRET_KEY, TELEGRAM_*
   alembic upgrade head
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. Frontend (в другом терминале):

   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # VITE_API_URL=http://localhost:8000/api/v1
   npm run dev
   ```

Vite по умолчанию: `http://localhost:5173`. В `backend/.env` добавьте этот origin в `ALLOWED_ORIGINS` (уже есть `http://localhost:5173` в примере).

## Production Setup

- **Образы:** `ghcr.io/<GITHUB_REPOSITORY>/backend:<tag>` и `ghcr.io/<GITHUB_REPOSITORY>/frontend:<tag>`, где `<GITHUB_REPOSITORY>` — slug репозитория в формате `владелец/имя` (для этого репозитория: `nilsnavi/fit_trackerpro`). Теги собирает workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) (в т.ч. `latest` и semver при релизе).
- **Compose:** [`docker-compose.prod.yml`](docker-compose.prod.yml) — Postgres и Redis во внутренней сети, наружу обычно смотрит **Nginx** (порты `80`/`443`). В `.env` на сервере нужны переменные из [`backend/.env.production.example`](backend/.env.production.example), включая `GITHUB_REPOSITORY` и `IMAGE_TAG` (их записывает деплой из GitHub Actions).
- **TLS:** положите сертификаты в `nginx/ssl` и проверьте [`nginx/nginx.conf`](nginx/nginx.conf).
- **Деплой из CI:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — по событию **release** или вручную (**workflow_dispatch**); на сервер синхронизируются `docker-compose.prod.yml` и `nginx/nginx.conf`, каталог приложения по умолчанию `~/fittracker-pro`. На сервере после настройки `.env` (как в шагах workflow): `docker-compose -f docker-compose.prod.yml pull` → `docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head` → `docker-compose -f docker-compose.prod.yml up -d`. С Docker Compose V2 те же команды через `docker compose ...`.

Проверки после выката: `GET /api/v1/system/health`, `GET /api/v1/system/version`, ответ фронта через прокси (как в deploy workflow).

## Architecture Overview

### Frontend

- `frontend/src/app` — bootstrap, router, providers, layouts
- `frontend/src/features` — домены (`workouts`, `exercises`, `profile`, `health`, `analytics`, `achievements`)
- `frontend/src/shared` — общие типы и cross-domain утилиты
- `frontend/src/pages` — страницы пользовательских flow (без дублирующих экранов по типам)

Ключевые принципы:

- **TanStack Query** для server state
- **Zustand** только для локального UI/session/draft state
- Workout modes рендерятся **config-driven** через `WorkoutTypeConfig`

### Backend

- `backend/app/api` — HTTP слой и маршруты
- `backend/app/services` — бизнес-логика
- `backend/app/repositories` — доступ к данным
- `backend/app/schemas` — контракты API
- `backend/app/models` — ORM модели

## API Layout (v1)

- `/api/v1/system/health`
- `/api/v1/system/version`
- `/api/v1/health-metrics/*`
- `/api/v1/analytics/*`
- `/api/v1/analytics/achievements/*`
- `/api/v1/analytics/challenges/*`
- `/api/v1/workouts/*`
- `/api/v1/exercises/*`
- `/api/v1/users/*`
- `/api/v1/users/auth/*`

### Legacy Aliases (Deprecated)

Legacy routes are still available for backward compatibility and marked as deprecated:

- `/api/v1/auth/*` -> use `/api/v1/users/auth/*`
- `/api/v1/achievements/*` -> use `/api/v1/analytics/achievements/*`
- `/api/v1/challenges/*` -> use `/api/v1/analytics/challenges/*`
- `/api/v1/emergency/*` -> use `/api/v1/system/emergency/*`

Removal plan: legacy aliases will be removed in `v1.2.0` (target date `2026-06-30`).

## Breaking Changes

- System health endpoint moved from `/api/v1/health` to `/api/v1/system/health`.
- New system version endpoint: `/api/v1/system/version`.
- User health metrics endpoints are now under `/api/v1/health-metrics/*`.
- Legacy page-per-workout-type screens were replaced by config-driven rendering (`WorkoutModePage` + `WorkoutTypeConfig`).

Стратегия health endpoints:

- `system/*` — техническое состояние сервиса (для deploy/monitoring)
- `health-metrics/*` — пользовательские метрики здоровья

## Environment Strategy

### Development

- `docker-compose.yml`
- Разрешены локальные порты Postgres/Redis
- Обязателен `SECRET_KEY` (без insecure fallback)

### Production

- `docker-compose.prod.yml`
- Приложение разворачивается из Docker images на GHCR (`ghcr.io/<GITHUB_REPOSITORY>/...`)
- Postgres/Redis не публикуются наружу
- Валидируется корректность env на старте backend:
  - `SECRET_KEY` >= 32 символов в production
  - `ALLOWED_ORIGINS` не может быть `*`
  - `DEBUG=false` в production

## Dependency Strategy (Backend)

- Основные зависимости: `backend/requirements/base.txt`
- Dev-зависимости: `backend/requirements/dev.txt`
- Prod-зависимости: `backend/requirements/prod.txt`
- Точка совместимости: `backend/requirements.txt` -> `-r requirements/dev.txt`

Все ключевые зависимости зафиксированы на pin-версиях.

## Deploy Source of Truth

- Build артефакты: GHCR images (`backend` и `frontend`)
- Deployment оркестрация: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) + `docker-compose.prod.yml`
- Сервер выполняет `docker compose pull` (или `docker-compose pull`) и `up -d` согласно workflow

## Migration Strategy

- Перед деплоем выполняется backup БД (best-effort)
- Миграции выполняются как отдельный шаг `alembic upgrade head`
- Ошибка миграции **останавливает деплой** (без `|| true`)
- После деплоя выполняются post-deploy проверки:
  - `/api/v1/system/health`
  - `/api/v1/system/version`
  - smoke-check через `http://localhost/` на хосте приложения

## CI/CD

Workflows в [`.github/workflows/`](.github/workflows/):

- [`test.yml`](.github/workflows/test.yml) — тесты/проверки
- [`build.yml`](.github/workflows/build.yml) — сборка и push Docker images в GHCR
- [`deploy.yml`](.github/workflows/deploy.yml) — production deployment + health verification
- [`migrate.yml`](.github/workflows/migrate.yml) — операции с миграциями
- [`security.yml`](.github/workflows/security.yml) — проверки безопасности
- [`dependabot-automerge.yml`](.github/workflows/dependabot-automerge.yml) — автослияние Dependabot (при настроенных правилах)

## Monitoring

- Sentry
- Prometheus
- Grafana

```bash
cd monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

## License

MIT
