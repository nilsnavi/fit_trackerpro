# DEPLOYMENT

Канонический production runbook для FitTracker Pro.

## 1. Стратегия (без изменений)

- Сборка и публикация образов: GitHub Actions, GHCR, versioned `IMAGE_TAG`.
- Деплой: compose-based, последовательность `pull -> migrate -> seed -> up -d`.
- Откат: по `docs/ROLLBACK_STRATEGY.md` (приложение и, при необходимости, БД).

## 2. Pre-deploy checklist

1. `IMAGE_TAG` не пустой и не `latest`.
2. GitHub Environment содержит обязательные секреты (DB, JWT, Telegram, SSH).
3. Рендер проходит: `docker compose -f docker-compose.prod.yml config --quiet`.
4. Nginx конфиг валиден: `nginx -t` (см. workflow pre-deploy validate).
5. Есть свежий pre-deploy backup БД.

## 2.1. Host prerequisites (важно для production)

В `docker-compose.prod.yml` используются **минимизированные bind mounts**. Чувствительные данные должны храниться **вне репозитория** и подключаться через переменные окружения:

- **TLS сертификаты (обязательно)**: `NGINX_SSL_DIR=/absolute/path/to/ssl`
  - Ожидаемые файлы: `fullchain.pem`, `privkey.pem`
  - Монтируется в контейнер как `/etc/nginx/ssl:ro`
- **Каталог бэкапов Postgres (рекомендуется)**: `BACKUPS_DIR=/absolute/path/to/backups`
  - Монтируется в контейнер как `/backups`
  - Не храните дампы/архивы в git
  
Логи edge `nginx` в production сохраняются в именованный Docker volume `nginx_logs` (не bind mount в рабочую копию репозитория).

Если переменные не заданы, compose использует локальные пути `./nginx/ssl` и `./backups` (допустимо для тестового запуска, но **не рекомендовано** для боевого сервера).

Также обратите внимание на hardening-опции:

- `backend` и edge `nginx` запускаются с `read_only: true` и `no-new-privileges`.
- `frontend` **не** использует `read_only`, потому что `startup.sh` генерирует `/usr/share/nginx/html/config.js` на старте.

## 3. Deploy sequence

1. Pull images:

```bash
docker compose -f docker-compose.prod.yml pull
```

2. Run migrations:

```bash
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
```

3. Seed reference data (idempotent):

```bash
docker compose -f docker-compose.prod.yml run --rm \
	-e REFERENCE_DATA_DIR=/app/reference_data \
	backend python3 -m app.cli.seed_reference_data apply
```

4. Start/update services:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 4. Post-deploy verification

```bash
curl -fsS https://<domain>/api/v1/system/health
curl -fsS https://<domain>/api/v1/system/version
curl -fsS https://<domain>/health
```

Ожидается HTTP 200 и валидный JSON (`status=healthy`, `version != null`).

## 5. Rollback trigger conditions

- smoke checks нестабильны в течение 3+ попыток подряд;
- миграция завершилась с ошибкой;
- критичные 5xx на ключевых маршрутах после релиза.

При срабатывании триггера выполняется rollback по `docs/ROLLBACK_STRATEGY.md` с выбором сценария:
- A: rollback только image/app;
- B: rollback image/app + migration downgrade;
- C: rollback image/app + database restore.

Для выбора используйте decision tree из `docs/ROLLBACK_STRATEGY.md` (раздел 3).

## 6. Minimal operational commands

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml restart backend
```
