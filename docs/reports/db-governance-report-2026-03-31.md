# DB governance report — FitTracker Pro

Дата: 2026-03-31  
Цель: привести проект к **единому source of truth** схемы БД: **Alembic + SQLAlchemy models**.

## 1) Инвентаризация артефактов схемы БД

| Файл/директория | Назначение | Используется runtime backend | Решение |
|---|---|---:|---|
| `database/migrations/` | Alembic миграции и окружение (`env.py`, `versions/*`) | **Да (инструментально)** — применяется через `alembic upgrade head` в CI/Deploy | **Оставить** (source of truth для эволюции схемы) |
| `database/migrations/env.py` | Подключение `Base.metadata` из backend моделей для autogenerate | **Да (инструментально)** | **Оставить** |
| `backend/app/domain/*` | SQLAlchemy ORM models (через `Base`) | **Да** — runtime доступ к данным + metadata для Alembic | **Оставить** (source of truth для модели данных) |
| `backend/app/infrastructure/database.py` | Engine/session wiring | **Да** | **Оставить** |
| `database/postgresql/migrations/` | SQL runbooks/миграции для особых операций (ZDT, validate, индексы) | **Нет** (не вызывается приложением автоматически) | **Оставить** как docs/runbooks (не source of truth) |
| `database/schema_v2.sql` | SQL snapshot (исторический DDL) | **Нет** | **Заархивировано** → `docs/db/legacy/schema_v2.sql` |
| `database/models.sql` | SQL snapshot (исторический DDL) | **Нет** | **Заархивировано** → `docs/db/legacy/models.sql` |
| `database/prisma/schema.prisma` | Prisma schema (альтернативная модель) | **Нет** | **Заархивировано** → `docs/db/legacy/schema.prisma` |

## 2) Что реально используется runtime-кодом backend

**Runtime**:

- SQLAlchemy engine/sessions: `backend/app/infrastructure/database.py`
- ORM models: `backend/app/domain/*` (через `app.domain.registry` и `Base`)

**Инструментально (операции/CI/CD), но не runtime-часть приложения**:

- Alembic: `database/migrations` (выполняется командой `alembic ...`)

**Не используется backend’ом**:

- Prisma schema (`docs/db/legacy/schema.prisma`)
- SQL snapshot’ы (`docs/db/legacy/{schema_v2.sql,models.sql}`)
- SQL runbooks не исполняются автоматически приложением (только вручную по инструкциям)

## 3) Целевая стратегия (source of truth = Alembic + SQLAlchemy models)

**Правило**: изменения схемы делаются через:

- обновление SQLAlchemy моделей в `backend/app/domain/*`
- Alembic revision (`alembic revision --autogenerate`)
- применение миграций `alembic upgrade head`

**SQL-runbooks** в `database/postgresql/migrations` остаются как исключения для сложных/zero-downtime операций, но не являются источником правды.

## 4) Безопасный план миграции (без поломки runtime)

Сделано (без влияния на runtime):

- Перемещены legacy-артефакты схемы в архив: `docs/db/legacy/*`
- Обновлены ссылки в документации, чтобы Prisma/SQL snapshots не считались source of truth
- Добавлена явная политика: `docs/db/schema-governance.md`

Дальнейшие шаги (по мере готовности, отдельными PR):

- удалить/почистить root Prisma toolchain (если ещё существует) **после** подтверждения поиском, что не используется
- при необходимости — добавить автоматическую проверку “schema drift” (например, `alembic revision --autogenerate --check` в CI)

## 5) Рекомендуемые проверки после изменений

- `alembic upgrade head`
- запуск тестов backend (`pytest` в `backend/`)
- smoke: `GET /api/v1/system/health`, `GET /api/v1/system/version`

