# Database schema governance — FitTracker Pro

## Source of truth (единый)

**Единый source of truth схемы БД**:

- **SQLAlchemy ORM models**: `backend/app/domain/*` (через `Base.metadata`)
- **Alembic migrations**: `database/migrations` (единственный поддерживаемый путь эволюции схемы)

Любые другие описания схемы (SQL snapshot-файлы, Prisma schema и т.п.) считаются **legacy/архивом** и не должны использоваться для внесения изменений в схему.

## Что используется runtime-кодом backend

- Backend подключается к БД через SQLAlchemy engine/session (`backend/app/infrastructure/database.py`).
- Alembic конфигурируется так, чтобы автогенерация опиралась на `Base.metadata`, собранную из `backend/app/domain/*` (`database/migrations/env.py`).

## Правила изменений схемы

- **Добавление/изменение схемы**: только через Alembic revision (`alembic revision --autogenerate -m "..."`) и последующий review миграции.
- **Прямой SQL допустим только как исключение**:
  - для “zero-downtime” и/или операций, которые плохо выражаются автогенерацией Alembic (например, сложные backfill’ы, online index create, validate-скрипты).
  - такие операции оформляются как **runbook** в `database/postgresql/migrations` и обязательно сопровождаются явным описанием шага отката и проверок.
- **Запрещено**:
  - редактировать schema-snapshot’ы как «источник правды»
  - вести параллельную Prisma-схему как актуальную модель данных

## Где лежат legacy-артефакты

- `docs/db/legacy/schema_v2.sql` — исторический SQL snapshot
- `docs/db/legacy/models.sql` — исторический SQL snapshot
- Prisma schema удалена из активного репозитория и не используется runtime

## Рекомендуемые проверки после изменений

Минимум:

- `alembic upgrade head` на чистой БД
- `alembic downgrade -1` (если миграция обратима) и снова `upgrade head`
- запуск backend тестов (см. `backend/app/tests`)

Production-практика:

- резервная копия перед миграцией (см. job `migrate` в `.github/workflows/deploy-environment.yml`, скрипт `scripts/backup_before_migrate.sh`, playbook `docs/db/rollback-playbook.md`)
- post-migration health checks: `GET /api/v1/system/health`, `GET /api/v1/system/version`

## Необратимые операции (DROP COLUMN, DROP TABLE)

- Требуют **явного ручного одобрения** в PR (как минимум один reviewer, знакомый с доменом данных).
- Должны выноситься в **отдельную миграцию** и мержиться **после** того, как прод-код (и при необходимости фоновые джобы) **больше не читают и не пишут** удаляемое поле/таблицу; при классическом multi-step подходе сначала деплой «код без использования», затем миграция с DROP.
- В PR обязателен **label** `database-breaking` (или эквивалентный процесс в вашем трекере), чтобы релиз-менеджер и дежурный видели повышенный риск.
- Перед такими миграциями в проде — **полный логический бэкап** (`pg_dump` / инфраструктурный snapshot); откат только через `alembic downgrade` часто **недостаточен** (данные уже уничтожены).

