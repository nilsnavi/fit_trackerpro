# Current Architecture

Краткая фиксация текущей архитектуры FitTracker Pro (as-is).

## 1. Общая схема

Приложение состоит из четырех основных контуров:
- **Frontend**: Telegram Mini App на React + Vite.
- **Backend**: REST API на FastAPI (слои API -> application -> domain -> infrastructure).
- **Data Layer**: PostgreSQL + Redis, миграции через Alembic и SQL migration scripts.
- **Delivery/Operations**: Docker Compose (dev/prod), GitHub Actions, Nginx, monitoring stack.

## 2. Frontend (React / Vite)

Основные модули:
- `frontend/src/main.tsx` - runtime entrypoint.
- `frontend/src/App.tsx` - app composition (providers + routes).
- `frontend/src/app` - app shell, providers, layouts.
- `frontend/src/features` - доменные модули (workouts, exercises, profile, health, analytics, achievements, home, emergency).
- `frontend/src/shared` - shared UI/components, API bindings и утилиты.

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
- `backend/app/application` - бизнес-сценарии (use cases) и оркестрация.
- `backend/app/domain` - доменные сущности/исключения и ORM-модели.
- `backend/app/infrastructure` - доступ к БД/Redis и внешним интеграциям, реализации репозиториев.
- `backend/app/schemas` - Pydantic DTO/контракты.
- `backend/app/middleware` - cross-cutting concerns (например rate limiting).
- `backend/app/bot` - Telegram bot/webhook integration.

API включает домены:
- system, auth, users, workouts, exercises, health-metrics, analytics, achievements, challenges, emergency.

## 4. Data & Migrations

Текущие артефакты данных:
- Alembic: `database/migrations`.
- SQL migrations/runbooks: `database/postgresql/migrations`.
- Legacy SQL snapshots (архив): `docs/db/legacy/schema_v2.sql`, `docs/db/legacy/models.sql`.
- Prisma schema удалена из активного репозитория; Prisma не используется runtime-кодом.

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

