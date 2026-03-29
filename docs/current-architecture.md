# Current Architecture

Краткая фиксация текущей архитектуры FitTracker Pro (as-is).

## 1. Общая схема

Приложение состоит из четырех основных контуров:
- **Frontend**: Telegram Mini App на React + Vite.
- **Backend**: REST API на FastAPI (слои API -> services -> repositories -> models).
- **Data Layer**: PostgreSQL + Redis, миграции через Alembic и SQL migration scripts.
- **Delivery/Operations**: Docker Compose (dev/prod), GitHub Actions, Nginx, monitoring stack.

## 2. Frontend (React / Vite)

Основные модули:
- `frontend/src/main.tsx` - runtime entrypoint.
- `frontend/src/app` - app shell, providers, router.
- `frontend/src/pages` - page-level экраны.
- `frontend/src/features` - доменные модули (workouts, exercises, profile, health, analytics, achievements, home, emergency).
- `frontend/src/components` - UI и feature components.
- `frontend/src/services` - API-клиент.

Текущий паттерн:
- Router-based SPA (`react-router-dom`).
- Server state через **TanStack Query**.
- Local/UI state через **Zustand** и React state.
- Telegram WebApp SDK используется через хуки/провайдеры для haptic/UI integration.

## 3. Backend (FastAPI)

Точка входа:
- `backend/app/main.py`.

Слои:
- `backend/app/api` - HTTP endpoints (v1 namespace).
- `backend/app/services` - бизнес-логика и orchestration.
- `backend/app/repositories` - data access.
- `backend/app/models` - SQLAlchemy ORM.
- `backend/app/schemas` - Pydantic DTO/контракты.
- `backend/app/middleware` - cross-cutting concerns (например rate limiting).
- `backend/app/bot` - Telegram bot/webhook integration.

API включает домены:
- system, auth, users, workouts, exercises, health-metrics, analytics, achievements, challenges, emergency.

## 4. Data & Migrations

Текущие артефакты данных:
- Alembic: `database/migrations`.
- SQL migrations/runbooks: `database/postgresql/migrations`.
- SQL snapshots: `database/schema_v2.sql`, `database/models.sql`.
- Prisma schema присутствует в `database/prisma/schema.prisma`.

Боевая БД:
- **PostgreSQL** (основное хранилище).
- **Redis** (cache/операционные сценарии).

## 5. Деплой и эксплуатация

Оркестрация:
- Dev: `docker-compose.yml`.
- Prod: `docker-compose.prod.yml`.

CI/CD:
- `.github/workflows/test.yml` - проверки/тесты.
- `.github/workflows/build.yml` - сборка образов.
- `.github/workflows/migrate.yml` - migration operations.
- `.github/workflows/deploy.yml` - production deploy.

Edge/infra:
- Nginx: `nginx/nginx.conf`.
- Monitoring stack: `monitoring/` (Prometheus, Grafana, Loki, Promtail).

## 6. Интеграции

Текущие внешние интеграции:
- **Telegram WebApp** (frontend client integration).
- **Telegram Bot API** (backend bot/webhook flow).
- **Sentry** (error monitoring, включается через env).
- **GHCR/GitHub Actions** (artifact delivery и deployment automation).

## 7. Текущее разделение ответственности

- **Frontend**: UI, navigation, client state, Telegram WebApp interaction.
- **Backend**: auth, domain logic, API contracts, bot/webhook handling.
- **Database**: schema evolution и SQL compatibility.
- **DevOps/SRE**: CI/CD, runtime orchestration, reverse proxy, observability.

