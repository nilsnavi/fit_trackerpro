# FitTracker Pro - Deployment Reference

Короткий operational runbook для деплоя и отката.

## Production Source of Truth

- Runtime артефакты: GHCR images
  - `ghcr.io/<repo>/backend:<tag>`
  - `ghcr.io/<repo>/frontend:<tag>`
- Оркестрация: `docker-compose.prod.yml`
- Automation: `.github/workflows/deploy.yml`

Приложение в production разворачивается по image-based модели (без `docker build`, `git pull` и `git checkout` на production-сервере).

## Production Deploy Flow

1. Синхронизировать infra-файлы на сервер (`docker-compose.prod.yml`, `nginx/nginx.conf`)
2. Пересоздать `.env` из GitHub Secrets
3. Сделать backup БД (best-effort)
4. `docker-compose -f docker-compose.prod.yml pull`
5. `docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head`
6. `docker-compose -f docker-compose.prod.yml up -d`
7. Post-deploy checks:
   - `GET http://localhost:8000/api/v1/system/health`
   - `GET http://localhost:8000/api/v1/system/version`
   - smoke-check `GET http://localhost/`

Если миграция падает, деплой останавливается.

## Rollback Strategy

Rollback workflow:
- останавливает текущий stack
- поднимает Postgres
- восстанавливает последний `backups/*.sql` (если есть)
- снова поднимает production stack

Команда на сервере (ручной эквивалент):

```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i fittracker-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backups/<latest>.sql
docker-compose -f docker-compose.prod.yml up -d
```

## Health Endpoint Strategy

- System health (for platform/deploy/uptime):
  - `/api/v1/system/health`
  - `/api/v1/system/version`
- User health metrics (business data):
  - `/api/v1/health-metrics/*`

## Environment Strategy

### Development (`docker-compose.yml`)
- Локальные порты Postgres/Redis открыты для удобства разработки.
- `SECRET_KEY` обязателен.

### Production (`docker-compose.prod.yml`)
- Postgres/Redis не публикуются наружу.
- Backend валидирует env при старте:
  - `SECRET_KEY` >= 32 в production
  - `ALLOWED_ORIGINS` не wildcard
  - `DEBUG=false`

## Required Variables

Backend:
- `DATABASE_URL`
- `DATABASE_URL_SYNC`
- `REDIS_URL`
- `SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBAPP_URL`
- `ALLOWED_ORIGINS`

Frontend:
- `VITE_API_URL`
- `VITE_TELEGRAM_BOT_USERNAME`

Infrastructure:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `GITHUB_REPOSITORY`
- `IMAGE_TAG` (optional, default `latest`)
