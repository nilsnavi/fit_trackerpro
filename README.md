# FitTracker Pro

Telegram Mini App для тренировок, здоровья и аналитики.

## Quick Start

```bash
git clone https://github.com/nilsnavi/fit_trackerpro.git
cd fit_trackerpro

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker-compose up -d
docker-compose exec backend alembic upgrade head
```

Доступ:
- Frontend: `http://localhost`
- Backend API: `http://localhost:8000/api/v1`
- Swagger (только при `DEBUG=true`): `http://localhost:8000/docs`

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
- Приложение разворачивается из Docker images (`ghcr.io/...`)
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
- Deployment оркестрация: `.github/workflows/deploy.yml` + `docker-compose.prod.yml`
- Server запускает `docker-compose pull` + `docker-compose up -d`

## Migration Strategy

- Перед деплоем выполняется backup БД (best-effort)
- Миграции выполняются как отдельный шаг `alembic upgrade head`
- Ошибка миграции **останавливает деплой** (без `|| true`)
- После деплоя выполняются post-deploy проверки:
  - `/api/v1/system/health`
  - `/api/v1/system/version`
  - smoke-check через `http://localhost/`

## CI/CD

Workflows в `.github/workflows`:
- `test.yml` — тесты/проверки
- `build.yml` — сборка и push Docker images
- `deploy.yml` — production deployment + health verification
- `migrate.yml` — операции с миграциями

## Monitoring

- Sentry
- Prometheus
- Grafana

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

## License

MIT
