# Architecture

Этот документ — каноническое описание архитектуры FitTracker Pro: как устроено сейчас (as-is) и какие принципы считаются обязательными.

## Контуры системы

- **Frontend**: Telegram Mini App на React + Vite
- **Backend**: REST API на FastAPI
- **Data**: PostgreSQL + Redis; миграции через Alembic
- **Operations**: Docker Compose (dev/prod), GitHub Actions, Nginx, monitoring stack

## Frontend (структура)

Ключевые каталоги (канон):

- `frontend/src/app` — загрузка приложения, роутер, провайдеры, лейауты
- `frontend/src/features` — домены (`workouts`, `exercises`, `profile`, `health`, `analytics`, `achievements`, `home`, `emergency`)
- `frontend/src/shared` — общие типы и утилиты, общий API-клиент/обвязки

Принципы:

- **TanStack Query** — server state и кэш данных API
- **Zustand** — только локальное UI-состояние/сессия/черновики (не дублировать server state)
- Режимы тренировок рендерятся **по конфигурации** (`WorkoutTypeConfig`), без копипасты отдельных страниц

## Backend (структура кода)

Фактическая структура `backend/app` (source of truth):

- `api/` — HTTP слой (роутеры v1, валидация входа, маппинг ошибок)
- `application/` — сценарии/use cases и оркестрация
- `domain/` — доменные сущности и исключения
- `infrastructure/` — БД (engine/session), репозитории, кэш, интеграции (Telegram initData и т.д.)
- `schemas/` — Pydantic DTO (контракты API)
- `settings/` — конфигурация из окружения
- `middleware/`, `core/` — cross-cutting concerns (security headers, rate limit, telemetry и т.д.)
- `bot/` — Telegram bot/webhook контур (вне REST)

Канонический документ по правилам слоёв и зависимостей: `docs/architecture/backend.md`.

## API (v1) — карта

Канонический базовый префикс: `/api/v1`.

Платформа:

- `GET /api/v1/system/health` (а также алиас `GET /health` с тем же JSON)
- `GET /api/v1/system/version`

Доменные маршруты:

- `/api/v1/users/*` и `/api/v1/users/auth/*`
- `/api/v1/workouts/*`
- `/api/v1/exercises/*`
- `/api/v1/health-metrics/*`
- `/api/v1/analytics/*` (включая `analytics/achievements`, `analytics/challenges`)

Legacy алиасы (устаревшие, запланировано удаление в `v1.2.0`, ориентир `2026-06-30`):

- `/api/v1/auth/*` → `/api/v1/users/auth/*`
- `/api/v1/achievements/*` → `/api/v1/analytics/achievements/*`
- `/api/v1/challenges/*` → `/api/v1/analytics/challenges/*`
- `/api/v1/emergency/*` → `/api/v1/system/emergency/*`

## Data & migrations

Source of truth схемы БД:

- SQLAlchemy модели: `backend/app/domain/*`
- Alembic миграции: `database/migrations`

Политика и правила: `docs/db/schema-governance.md`.

## Deployment model (кратко)

- Build/push образов: `.github/workflows/build.yml`
- Deploy/smoke/rollback: `.github/workflows/deploy.yml`
- Runtime: `docker-compose.prod.yml`, каталог `~/fittracker-pro`, прокси `nginx/nginx.conf`

Подробности: `docs/deployment.md`.

