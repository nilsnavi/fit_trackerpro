# ARCHITECTURE AUDIT (Этап 0)

Дата: 2026-03-27  
Приоритет этапа: **P0**  
Статус: завершен (аудит структуры + фиксация точек входа)

## 1) Точки входа системы

### Frontend
- Runtime entry: `frontend/src/main.tsx`
- App composition entry: `frontend/src/App.tsx` -> `frontend/src/app/App.tsx`
- Routing entry: `frontend/src/app/router.tsx`

### Backend
- API entry: `backend/app/main.py`
- Router registration: `backend/app/main.py` (`include_router(...)`)
- Telegram webhook entry: `POST /telegram/webhook` в `backend/app/main.py`

### DevOps / Deploy
- Dev compose: `docker-compose.yml`
- Prod compose: `docker-compose.prod.yml`
- CI/CD workflows: `.github/workflows/{test,build,migrate,deploy}.yml`
- Nginx: `nginx/nginx.conf` (+ `frontend/nginx.conf` для фронтенд-образа)
- Monitoring stack: `monitoring/docker-compose.monitoring.yml`

---

## 2) Карта модулей репозитория

## Frontend (`frontend/`)
- `src/app` - shell/layout/providers/router
- `src/pages` - экраны приложения
- `src/features` - доменные API/store/hooks (workouts, exercises, profile, health, analytics, achievements)
- `src/components` - UI/feature components
- `src/services` - базовый HTTP-клиент и сервисы
- `src/types`, `src/shared/types` - типы
- `dist/`, `coverage/`, `node_modules/` - build/test artifacts

## Backend (`backend/`)
- `app/api` - HTTP endpoints
- `app/services` - бизнес-логика
- `app/repositories` - доступ к данным
- `app/models` - SQLAlchemy ORM
- `app/schemas` - pydantic-контракты
- `app/middleware`, `app/utils`, `app/bot`
- `app/tests`
- `requirements/{base,dev,prod}.txt`
- `htmlcov/`, `.coverage`, `coverage.xml`, `.venv`, `venv` - runtime/test artifacts

## Database (`database/`)
- `migrations/` - Alembic
- `postgresql/migrations/` - SQL runbooks/migration scripts
- `schema_v2.sql`, `models.sql` - SQL snapshots/DDL
- `prisma/schema.prisma` - альтернативная модель данных (Prisma)

## DevOps / Infra
- `.github/workflows` - CI/CD
- `monitoring/` - Prometheus/Loki/Grafana
- `nginx/` - reverse proxy config
- `deploy.sh` - локальный deploy script

## Docs
- `README.md`, `README-DEPLOYMENT.md`, `TELEGRAM_SETUP.md`
- `docs/*` - setup/deploy/security/checklists/audit
- `.qoder/repowiki/*` - автогенерируемая wiki-документация

---

## 3) Ключевые проблемы (P0/P1/P2)

## P0 (критично для управляемости архитектуры)

1. **Дублирование и рассинхронизация источников схемы БД**
   - Параллельно существуют:
     - `database/migrations` (Alembic)
     - `database/postgresql/migrations` (ручные SQL-миграции)
     - `database/schema_v2.sql`, `database/models.sql` (snapshot-скрипты)
     - `database/prisma/schema.prisma` (отдельная Prisma-модель)
   - По факту `prisma` не используется кодом приложения (найден только `database/prisma/schema.prisma`), но присутствуют root `package.json`/`package-lock.json`/`node_modules` под Prisma.
   - Риск: drift схемы и невозможность однозначно определить Source of Truth.

2. **Конфликтная структура frontend-страниц (часть страниц не маршрутизируется)**
   - В роутере `frontend/src/app/router.tsx` подключена только часть `src/pages`.
   - Файлы `frontend/src/pages/AchievementsPage.tsx` и `frontend/src/pages/RestTimerDemo.tsx` не имеют потребителей (поиск по коду нашел только самоопределение).
   - `frontend/src/pages/Calendar.tsx` присутствует, но в роутере отсутствует маршрут.
   - Риск: мертвый код, скрытый функционал, ложные ожидания по покрытию feature.

3. **Дублирование deploy-документации с пересечением ответственности**
   - Одновременно поддерживаются `README-DEPLOYMENT.md` и `docs/DEPLOYMENT.md`.
   - `docs/DOCS_INDEX.md` описывает секции `README-DEPLOYMENT.md`, которых в текущей версии файла нет (признак устаревшего индекса).
   - Риск: операционные ошибки при релизе из-за разных/устаревших инструкций.

## P1 (высокий приоритет рефакторинга)

4. **Смешение production-кода и артефактов среды в дереве проекта**
   - В рабочем дереве присутствуют: `backend/htmlcov`, `htmlcov`, `frontend/dist`, `backend/.venv`, `backend/venv`, root `node_modules`.
   - Отдельные cache-файлы даже отслеживаются git (`database/migrations/__pycache__/*.pyc`, `backend/coverage.xml`).
   - Риск: шум в аудите, сложность review, случайные коммиты артефактов.

5. **Технический долг в backend по quality-гейтам (ruff)**
   - `python -m ruff check backend` выявил ошибки:
     - неиспользуемые импорты (`backend/app/api/users.py`, `backend/app/bot/main.py`, `backend/app/models/__init__.py`, `backend/app/models/workout_template.py`, `backend/app/services/workouts_service.py`)
     - неиспользуемые локальные переменные (`backend/app/middleware/rate_limit.py`, `backend/app/services/health_service.py`)
     - undefined name (`backend/app/models/user.py`)
   - Риск: скрытые баги и снижение доверия к статическим проверкам.

6. **Неконсистентность ignore-стратегии**
   - `backend/.gitignore` содержит секцию `alembic/versions/*`, но актуальные миграции лежат в `database/migrations/...`.
   - Похоже на legacy-наследие старой структуры.

7. **Частично дублирующиеся frontend entry/структуры**
   - Есть `frontend/src/App.tsx` и `frontend/src/app/App.tsx` (связаны через re-export).
   - Это не баг само по себе, но при наличии других дублей усложняет "где реальный entry" для новых участников.

## P2 (средний приоритет, но желательно закрыть)

8. **Дубли/перекрытие доменных артефактов docs vs repowiki**
   - Есть полноценные docs в `docs/`, плюс большой слой `.qoder/repowiki`.
   - Без явной политики владения это создает "две документации".

9. **Root-level Node toolchain выглядит как вспомогательный, но не оформлен как отдельный модуль**
   - Root `package.json` используется только под Prisma.
   - Нет явного описания в `README.md`, зачем это нужно и как соотносится с SQLAlchemy/Alembic.

---

## 4) Потенциально мертвый код / кандидаты на чистку

- `frontend/src/pages/AchievementsPage.tsx` - не подключен к роутеру и не импортируется.
- `frontend/src/pages/RestTimerDemo.tsx` - демо-страница, не подключена.
- `frontend/src/pages/Calendar.tsx` - полноценная страница, но без маршрута.
- `database/prisma/schema.prisma` + root prisma dependencies - не интегрированы с runtime backend.
- Cache/coverage artifacts внутри репозитория (особенно tracked pyc/coverage.xml) - кандидаты на удаление и блокировку через `.gitignore`.

---

## 5) Зоны рефакторинга (предлагаемый порядок)

1. **Schema Governance (P0)**
   - Утвердить единый Source of Truth для схемы (рекомендуемо: Alembic + SQL migration policy, либо Prisma, но не одновременно без явного моста).
   - Зафиксировать policy в одном документе и удалить неиспользуемую параллельную схему.

2. **Frontend Routing Cleanup (P0)**
   - Либо подключить фактические страницы к `AppRouter`, либо удалить/архивировать неиспользуемые.
   - Для демо-экранов ввести отдельную папку `src/sandbox` или feature flag route.

3. **Docs Consolidation (P0/P1)**
   - Определить single deploy runbook.
   - Привести `docs/DOCS_INDEX.md` в соответствие фактическому содержимому.

4. **Repository Hygiene (P1)**
   - Удалить tracked generated files (`*.pyc`, coverage artifacts).
   - Актуализировать `.gitignore` (root/backend/frontend) под реальную структуру.

5. **Static Quality Gate Recovery (P1)**
   - Закрыть ruff-ошибки, затем включить check как mandatory в CI.

---

## 6) Краткий итог

Архитектурно проект уже разделен на frontend/backend/database/devops, но в текущем состоянии есть несколько параллельных "истин" (схема БД, документация, страницы UI), а также накопившиеся артефакты среды. Для этапа P0 критично сначала устранить рассинхронизацию источников правды и почистить входные точки, чтобы следующий рефакторинг выполнялся на стабильной базе.

