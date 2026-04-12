# Playbook: откат после сбоя миграции (FitTracker Pro)

Alembic-миграции лежат в `database/migrations/`. Деплой выполняется через GitHub Actions (см. `.github/workflows/deploy.yml` и reusable `.github/workflows/deploy-environment.yml`). При ошибке на шаге миграции пайплайн останавливается; ниже — согласованная процедура отката приложения и схемы БД.

## Когда имеет смысл rollback

- В логах CI или на сервере видна **ошибка Alembic** (`alembic upgrade head` завершился ненулевым кодом, traceback при применении revision).
- После выката новой версии **готовность API не восстанавливается**: `GET /api/v1/system/ready` отвечает **503** или нестабильно падает из‑за несовместимости схемы и кода.
- Зафиксирована **частично применённая миграция** (редкий случай; тогда действуйте осторожно и по шагам ниже, при необходимости — с восстановлением из бэкапа).

## Обязательный бэкап до деплоя / до ручного `upgrade`

На машине с `docker compose` (каталог деплоя, например `~/fittracker-pro`):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "backup_$(date +%Y%m%d_%H%M%S).sql"
```

Для локального `docker-compose.yml` сервис также называется `postgres`; при необходимости подставьте `-f docker-compose.yml`.

В CI перед миграцией дополнительно вызывается `scripts/backup_before_migrate.sh` (см. job `migrate` в `.github/workflows/deploy-environment.yml`).

## Откат схемы Alembic

Команды выполняйте в окружении с тем же `alembic.ini`, что и в проде (в образе backend или через `docker compose ... run --rm backend`), из каталога с доступом к `database/migrations`:

```bash
alembic current          # текущая revision в БД
alembic history          # цепочка revisions

alembic downgrade -1     # на одну версию назад
alembic downgrade <revision_id>   # до конкретной revision
```

После `downgrade` проверьте `alembic current` и прогоните smoke: `GET /api/v1/system/ready`.

## Откат Docker-образов

Тег образа задаётся переменной **`IMAGE_TAG`** в `.env` на сервере (см. `docker-compose.prod.yml`). Откат приложения:

1. Верните в `.env` предыдущий стабильный тег (или значение из `.last-stable-deploy.env` / метаданных деплоя, если вы их ведёте).
2. Подтяните образы и перезапустите стек:

```bash
# задайте предыдущий тег в .env (IMAGE_TAG=...)
docker compose -f docker-compose.prod.yml pull backend frontend
docker compose -f docker-compose.prod.yml up -d
```

Примечание: у `docker compose pull` нет флага `--tag`; тег задаётся через `IMAGE_TAG` в окружении compose.

## Проверка после отката

- `GET /api/v1/system/ready` — ожидается **200**, в теле JSON статус готовности (в т.ч. проверка БД).
- При необходимости: `GET /api/v1/system/health`, `GET /api/v1/system/version`.

## Когда **не** стоит делать `alembic downgrade`

- Миграция выполнила **необратимые** DDL-операции (например `DROP COLUMN`, `DROP TABLE`, необратимые преобразования типов с потерей данных). Откат revision **не вернёт** удалённые данные.
- В таких случаях путь восстановления — **восстановление из `pg_dump`** (или из инфраструктурного снапшота БД), а не только `downgrade`.

Политика необратимых миграций описана в `docs/db/schema-governance.md`.
