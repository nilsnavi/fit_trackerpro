# Целевая архитектура (to-be)

**Приоритет:** P1  
**Назначение:** единая картина направления развития FitTracker Pro после рефакторинга. Текущее состояние зафиксировано в [`current-architecture.md`](current-architecture.md).

---

## 1. Frontend structure

Цель — **feature-sliced** клиент Telegram Mini App (React + Vite) с чёткими границами и без дублирования экранов.

| Зона | Путь | Ответственность |
|------|------|-----------------|
| Bootstrap | `frontend/src/app` | `main`/`App`, router, провайдеры (Query, Telegram, тема), layouts/shell |
| Домены | `frontend/src/features/<domain>` | UI, хуки, локальные типы, **страницы** (`pages/`), доменная логика представления |
| Общее | `frontend/src/shared` | HTTP-клиент и доменные API-модули (`shared/api/domains/*`), UI-kit (`shared/ui`), cross-cutting хуки, общие типы |
| Локальное состояние | `frontend/src/stores` | Zustand: только UI-сессия, черновики, эфемерное состояние (не дублировать server state) |

### Домены в `features/`

Целевой набор модулей (у каждого — по необходимости `components/`, `hooks/`, `pages/`, локальные `types/`, `lib/`):

| Домен | Назначение |
|-------|------------|
| `workouts` | Тренировки, календарь, конструктор, режимы выполнения (config-driven). |
| `exercises` | Каталог и добавление упражнений. |
| `profile` | Профиль пользователя и связанный auth UI. |
| `health` | Трекеры метрик здоровья (глюкоза, вода, wellness и т.д.). |
| `analytics` | Аналитика и отчёты. |
| `achievements` | Достижения. |
| `home` | Главный экран и виджеты: сводка и быстрые действия; данные с API и shared-маппинги (`shared/lib` / типы), без копирования серверной бизнес-логики. |
| `emergency` | Аварийный режим и сценарии экстренной помощи — отдельный UX-контур, изолированный от обычных флоу. |

**Принципы:**

- **TanStack Query** — единственный источник правды для данных с API (кэш, инвалидация, optimistic updates там, где уместно).
- **Zustand** — узкие сценарии: драфты тренировок, UI-флаги, сессия мини-приложения.
- **Маршрутизация** — маршруты в `app/router.tsx` (или рядом), экраны живут в `features/*/pages`, без отдельного «параллельного дерева» страниц вне фич.
- **API** — вызовы через `shared/api` (единый клиент, доменные обёртки, согласованные query keys).
- **Конфиг-драйв** — режимы тренировок и повторяющиеся варианты UI задаются конфигурацией (например `WorkoutTypeConfig`), а не копипастой страниц.

**Итог рефакторинга:** документация, структура каталогов и код совпадают; устаревшие пути (`frontend/src/pages` на корне, разрозненные `services/*` вместо `shared/api`) не используются.

---

## 2. Backend structure

Цель — **слои + явный домен**, предсказуемые контракты API и тонкий HTTP-слой.

| Слой | Путь | Ответственность |
|------|------|-----------------|
| HTTP | `backend/app/api/v1` | Роутеры, валидация входа, маппинг в сервисы, OpenAPI-теги |
| Application | `backend/app/application` | Бизнес-логика, оркестрация, правила use-case |
| Доступ к данным | `backend/app/infrastructure/repositories` | Репозитории и доступ к данным (БД/кэш), изоляция SQLAlchemy от API |
| Контракты | `backend/app/schemas` | Pydantic-модели запросов/ответов (публичный контракт API) |
| Домен | `backend/app/domain` | Сущности и правила предметной области (по возможности без зависимости от FastAPI) |
| Инфраструктура | `backend/app/infrastructure`, `backend/app/core`, `backend/app/middleware` | БД-сессии/engine, интеграции, безопасность, логирование, rate limit, телеметрия |
| Интеграции | `backend/app/bot` | Telegram Bot / webhook, отдельно от REST-слоя |

**Принципы:**

- Новые эндпоинты — только под префиксом `/api/v1`, согласованные теги и `operation_id` для клиентов.
- **Legacy-алиасы** (см. `README.md`) удаляются по плану версии; целевое API — канонические пути (`users/auth`, `analytics/achievements`, и т.д.).
- Миграции схемы — Alembic как основной путь; SQL-runbooks в `database/postgresql/migrations` — для особых операций.

---

## 3. Deploy model

Цель — **образы из registry**, воспроизводимые релизы, минимум ручных действий на сервере.

| Аспект | Целевое состояние |
|--------|-------------------|
| Артефакты | Собранные образы `ghcr.io/<GITHUB_REPOSITORY>/backend:<tag>` и `.../frontend:<tag>` (см. `.github/workflows/build.yml`) |
| Runtime | `docker-compose.prod.yml`: Postgres, Redis (внутренняя сеть), backend, frontend, Nginx |
| Выкат | `.github/workflows/deploy.yml`: синхронизация compose + `nginx/nginx.conf`, `pull`, `alembic upgrade head`, `up -d`, смоук |
| Каталог на сервере | `~/fittracker-pro` (как в workflow) |
| Откат | Автоматический rollback образов; политика БД — [`ROLLBACK_STRATEGY.md`](ROLLBACK_STRATEGY.md) |
| Dev | `docker-compose.yml`: сборка из Dockerfile или гибрид с хостом (см. `README.md`) |

На production **не** полагаемся на `git pull` и локальный `docker build` приложения — только на теги образов.

---

## 4. Env strategy

Цель — **разделение dev/prod**, секреты вне репозитория, один источник правды по именам переменных.

| Окружение | Источник правды | Примечание |
|-----------|-----------------|------------|
| Локальная разработка | `backend/.env.example`, `frontend/.env.example` | Копия в `.env`, секреты не коммитить |
| Docker dev | `docker-compose.yml` + `--env-file` для backend/frontend | См. Quick Start в `README.md` |
| Production (сервер) | Корневой `.env` на сервере, при CI — генерируется из GitHub Secrets (`deploy.yml`) | `DATABASE_URL` / `REDIS_URL` в prod задаёт compose из `POSTGRES_*`, не дублировать вручную без необходимости |
| Полный перечень переменных | [`env-matrix.md`](env-matrix.md) | Обновлять при добавлении env |

**Принципы:**

- Backend в production: валидация при старте (`SECRET_KEY`, `ALLOWED_ORIGINS`, `DEBUG=false`) — без ослаблений.
- Frontend: `VITE_*` задаются на этапе сборки образа; production-значения приходят из секретов/аргументов сборки, согласованных с деплоем.
- Опциональная наблюдаемость: `SENTRY_DSN` / `VITE_SENTRY_DSN` без обязательности для локальной разработки.

---

## 5. Health strategy

Разделение **технического здоровья сервиса** и **пользовательских метрик здоровья** — обязательное правило.

| Категория | Эндпоинты / механизмы | Назначение |
|-----------|------------------------|------------|
| Платформа | `GET /api/v1/system/health`, `GET /api/v1/system/version` | Деплой, uptime, алерты, CI smoke; публичные, без пользовательских данных |
| Пользовательские данные | `GET/POST ... /api/v1/health-metrics/*` | Глюкоза, вода, wellness и т.д.; защищены auth как остальной доменный API |
| Инфраструктура | `healthcheck` в `docker-compose.yml` / `docker-compose.prod.yml` для Postgres и Redis | Условия `depends_on: condition: service_healthy` |
| Наблюдаемость | Sentry; стек `monitoring/` (Prometheus, Grafana, Loki) | Ошибки, метрики, логи — по мере включения в окружении |

**Принципы:**

- Не смешивать «готовность API» и «статистику здоровья пользователя» в одном URL.
- Post-deploy и внешний smoke опираются на `system/health` и согласованный публичный доменный пробный запрос (как в `deploy.yml`).
- Телеметрия (метрики/трейсы) не должна ломать SLO на публичных health-URL (исключения в middleware/сэмплировании — по `backend/app/core/telemetry`).

---

## Связанные документы

- [`current-architecture.md`](current-architecture.md) — as-is
- [`README.md`](../README.md), [`README-DEPLOYMENT.md`](../README-DEPLOYMENT.md) — запуск и операции
- [`DEPLOYMENT.md`](DEPLOYMENT.md), [`ROLLBACK_STRATEGY.md`](ROLLBACK_STRATEGY.md) — выкат и откат
- [`env-matrix.md`](env-matrix.md) — переменные окружения
