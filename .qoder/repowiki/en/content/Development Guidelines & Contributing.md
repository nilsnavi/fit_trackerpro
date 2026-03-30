# Руководство по разработке и участию в проекте

<cite>
**Файлы, на которые ссылается документ**
- [README.md](file://README.md)
- [ENVIRONMENT_SETUP.md](file://docs/ENVIRONMENT_SETUP.md)
- [backend/app/main.py](file://backend/app/main.py)
- [backend/app/middleware/auth.py](file://backend/app/middleware/auth.py)
- [backend/app/models/base.py](file://backend/app/models/base.py)
- [backend/requirements.txt](file://backend/requirements.txt)
- [backend/Dockerfile](file://backend/Dockerfile)
- [backend/pytest.ini](file://backend/pytest.ini)
- [frontend/package.json](file://frontend/package.json)
- [frontend/tsconfig.json](file://frontend/tsconfig.json)
- [frontend/jest.config.js](file://frontend/jest.config.js)
- [frontend/tailwind.config.js](file://frontend/tailwind.config.js)
- [frontend/postcss.config.js](file://frontend/postcss.config.js)
- [frontend/src/App.tsx](file://frontend/src/App.tsx)
- [frontend/src/main.tsx](file://frontend/src/main.tsx)
- [.github/workflows/test.yml](file://.github/workflows/test.yml)
- [.github/workflows/build.yml](file://.github/workflows/build.yml)
- [.github/workflows/deploy.yml](file://.github/workflows/deploy.yml)
- [.github/workflows/migrate.yml](file://.github/workflows/migrate.yml)
</cite>

## Содержание
1. [Введение](#introduction)
2. [Структура проекта](#project-structure)
3. [Основные компоненты](#core-components)
4. [Обзор архитектуры](#architecture-overview)
5. [Детальный разбор компонентов](#detailed-component-analysis)
6. [Анализ зависимостей](#dependency-analysis)
7. [Производительность](#performance-considerations)
8. [Устранение неполадок](#troubleshooting-guide)
9. [Настройка среды разработки](#development-environment-setup)
10. [Стандарты кода и соглашения об именовании](#coding-standards-and-naming-conventions)
11. [Форматирование кода и линтинг](#code-formatting-and-linting)
12. [Требования к тестированию](#testing-requirements)
13. [Soft delete policy (обратимое удаление)](#soft-delete-policy)
14. [Стандарт миграций БД (Alembic)](#database-migrations-standard)
15. [Добавление функций и изменение поведения](#adding-new-features-and-modifying-functionality)
16. [Обратная совместимость](#backward-compatibility-guidelines)
17. [Pull request и код-ревью](#pull-request-process-and-code-review-standards)
18. [Стандарты документации](#documentation-standards)
19. [Сообщения коммитов](#commit-message-conventions)
20. [Выпуск релизов](#release-procedures)
21. [Отладка, профилирование и оптимизация](#debugging-profiling-and-performance-optimization)
22. [Заключение](#conclusion)

<a id="introduction"></a>
## Введение
Этот документ описывает правила разработки для участников FitTracker Pro: стандарты кода, архитектурные паттерны, рабочие процессы, настройку окружения, тестирование, pull request’ы, документацию, релизы и эксплуатацию. Цель — обеспечить единообразие, сопровождаемость и качество изменений во фронтенде (React + TypeScript + Vite), бэкенде (FastAPI), базе данных (PostgreSQL и Alembic) и инструментах DevOps.

<a id="project-structure"></a>
## Структура проекта
FitTracker Pro организован как несколько сервисов:
- **frontend**: React + TypeScript + Vite, маршрутизация, состояние и UI-компоненты
- **backend**: приложение FastAPI с роутерами, middleware, моделями, схемами и сервисами
- **database**: PostgreSQL и миграции Alembic
- **monitoring**: стек Prometheus + Grafana
- **nginx**: конфигурация обратного прокси
- **docs**: развёртывание и настройка окружения
- **.github/workflows**: CI/CD — тесты, сборка, миграции, деплой

```mermaid
graph TB
subgraph "Frontend"
FE_App["React-приложение<br/>src/main.tsx"]
FE_Routes["Маршрутизация<br/>src/App.tsx"]
FE_Components["Компоненты<br/>src/components/*"]
FE_Hooks["Хуки<br/>src/hooks/*"]
FE_Services["Сервисы<br/>src/services/*"]
FE_Tests["Тесты Jest<br/>src/__tests__/*"]
end
subgraph "Backend"
BE_Main["Приложение FastAPI<br/>backend/app/main.py"]
BE_Routers["Роутеры<br/>backend/app/api/*"]
BE_Middleware["Middleware<br/>backend/app/middleware/*"]
BE_Models["Модели<br/>backend/app/models/*"]
BE_Schemas["Схемы<br/>backend/app/schemas/*"]
BE_Services["Сервисы<br/>backend/app/services/*"]
BE_Tests["Тесты Pytest<br/>backend/app/tests/*"]
end
subgraph "Database"
DB_Postgres["PostgreSQL"]
DB_Alembic["Миграции Alembic"]
end
subgraph "DevOps"
DO_Docker["Docker-образы"]
DO_GHA["GitHub Actions<br/>.github/workflows/*"]
DO_Nginx["Конфиг Nginx"]
DO_Monitoring["Prometheus + Grafana"]
end
FE_App --> BE_Main
BE_Main --> DB_Postgres
BE_Main --> DB_Alembic
DO_GHA --> DO_Docker
DO_Docker --> BE_Main
DO_Docker --> FE_App
```

**Источники диаграммы**
- [backend/app/main.py:1-126](file://backend/app/main.py#L1-L126)
- [frontend/src/main.tsx:1-23](file://frontend/src/main.tsx#L1-L23)
- [frontend/src/App.tsx:1-35](file://frontend/src/App.tsx#L1-L35)
- [.github/workflows/test.yml](file://.github/workflows/test.yml)
- [.github/workflows/build.yml](file://.github/workflows/build.yml)
- [.github/workflows/deploy.yml](file://.github/workflows/deploy.yml)
- [.github/workflows/migrate.yml](file://.github/workflows/migrate.yml)

**Источники раздела**
- [README.md:5-16](file://README.md#L5-L16)

<a id="core-components"></a>
## Основные компоненты
- **Backend (FastAPI)**: инициализация Sentry, CORS и rate limiting, монтирование роутеров под общим префиксом; health и документация API в зависимости от окружения.
- **Frontend (React)**: TanStack Query с разумными значениями по умолчанию, маршруты, общая дизайн-система на Tailwind CSS.
- **База данных**: декларативная база SQLAlchemy и миграции Alembic.
- **CI/CD**: автоматизация тестов, сборки образов, миграций и деплоев.

Ключевые места в коде:
- Инициализация приложения и подключение роутеров: [backend/app/main.py:56-107](file://backend/app/main.py#L56-L107)
- Аутентификация и JWT: [backend/app/middleware/auth.py:21-251](file://backend/app/middleware/auth.py#L21-L251)
- Базовая ORM-модель: [backend/app/models/base.py:1-7](file://backend/app/models/base.py#L1-L7)
- Точка входа фронтенда и Query Client: [frontend/src/main.tsx:7-14](file://frontend/src/main.tsx#L7-L14)
- Маршрутизация: [frontend/src/App.tsx:12-29](file://frontend/src/App.tsx#L12-L29)

**Источники раздела**
- [backend/app/main.py:56-107](file://backend/app/main.py#L56-L107)
- [backend/app/middleware/auth.py:21-251](file://backend/app/middleware/auth.py#L21-L251)
- [backend/app/models/base.py:1-7](file://backend/app/models/base.py#L1-L7)
- [frontend/src/main.tsx:7-14](file://frontend/src/main.tsx#L7-L14)
- [frontend/src/App.tsx:12-29](file://frontend/src/App.tsx#L12-L29)

<a id="architecture-overview"></a>
## Обзор архитектуры
Разделение ответственности:
- **Frontend**: интерфейс, маршруты, состояние, вызовы API
- **Backend**: REST API, аутентификация, лимиты запросов, middleware
- **База данных**: хранение данных и миграции схемы
- **DevOps**: воспроизводимые сборки, мониторинг, деплой

```mermaid
sequenceDiagram
participant Browser as "Браузер"
participant Frontend as "React-приложение"
participant API as "Бэкенд FastAPI"
participant DB as "PostgreSQL"
participant Sentry as "Sentry"
Browser->>Frontend : "Переход по маршруту"
Frontend->>API : "HTTP с Authorization"
API->>API : "CORS + лимит + auth middleware"
API->>DB : "Асинхронный запрос SQLAlchemy"
DB-->>API : "Результат"
API-->>Frontend : "JSON-ответ"
Frontend-->>Browser : "Отрисовка UI"
Note over API,Sentry : "Sentry при настроенном DSN"
```

**Источники диаграммы**
- [backend/app/main.py:77-87](file://backend/app/main.py#L77-L87)
- [backend/app/middleware/auth.py:111-131](file://backend/app/middleware/auth.py#L111-L131)
- [backend/app/main.py:32-43](file://backend/app/main.py#L32-L43)

**Источники раздела**
- [backend/app/main.py:77-87](file://backend/app/main.py#L77-L87)
- [backend/app/middleware/auth.py:111-131](file://backend/app/middleware/auth.py#L111-L131)

<a id="detailed-component-analysis"></a>
## Детальный разбор компонентов

### Middleware аутентификации (backend)
Слой аутентификации отвечает за выпуск и проверку JWT, внедрение зависимостей для текущего пользователя, обязательную схему Bearer и типы access/refresh.

```mermaid
flowchart TD
Start(["Входящий запрос"]) --> CheckAuth["Проверка заголовка Authorization"]
CheckAuth --> Scheme{"Схема Bearer?"}
Scheme --> |Нет| Deny["401 Unauthorized"]
Scheme --> |Да| Verify["Проверка JWT"]
Verify --> Valid{"Токен валиден?"}
Valid --> |Нет| Deny
Valid --> |Да| Extract["Извлечь ID пользователя"]
Extract --> LoadUser["Загрузить пользователя из БД"]
LoadUser --> Found{"Пользователь есть?"}
Found --> |Нет| NotFound["404 Not Found"]
Found --> |Да| Allow["Передать в обработчик"]
```

**Источники диаграммы**
- [backend/app/middleware/auth.py:117-172](file://backend/app/middleware/auth.py#L117-L172)
- [backend/app/middleware/auth.py:174-203](file://backend/app/middleware/auth.py#L174-L203)

**Источники раздела**
- [backend/app/middleware/auth.py:21-251](file://backend/app/middleware/auth.py#L21-L251)

### Состояние и загрузка данных (frontend)
TanStack Query инициализируется с политикой устаревания и повторов по умолчанию; приложение оборачивается в провайдер. Маршруты сосредоточены в одном компоненте.

```mermaid
sequenceDiagram
participant Root as "main.tsx"
participant Provider as "QueryClientProvider"
participant App as "App.tsx"
participant Router as "Routes"
participant Page as "Страница"
Root->>Provider : "Создать QueryClient с настройками"
Provider->>App : "Отрисовать App"
App->>Router : "Описать маршруты"
Router->>Page : "Отрисовать выбранную страницу"
```

**Источники диаграммы**
- [frontend/src/main.tsx:7-14](file://frontend/src/main.tsx#L7-L14)
- [frontend/src/App.tsx:12-29](file://frontend/src/App.tsx#L12-L29)

**Источники раздела**
- [frontend/src/main.tsx:7-14](file://frontend/src/main.tsx#L7-L14)
- [frontend/src/App.tsx:12-29](file://frontend/src/App.tsx#L12-L29)

### Базовая модель БД
Декларативная база SQLAlchemy — основа всех ORM-моделей.

**Источники раздела**
- [backend/app/models/base.py:1-7](file://backend/app/models/base.py#L1-L7)

<a id="dependency-analysis"></a>
## Анализ зависимостей
- **Backend**: `requirements.txt` — FastAPI, SQLAlchemy, Alembic, Pydantic, безопасность, Celery/Redis, тесты и логирование.
- **Frontend**: React, TanStack Query, Tailwind, тестовые фреймворки.
- **CI/CD**: workflow’ы связывают тесты, сборку, миграции и деплой.

```mermaid
graph LR
BE_Req["backend/requirements.txt"] --> BE_Core["FastAPI + БД + безопасность"]
FE_Pkg["frontend/package.json"] --> FE_Core["React + Query + Tailwind"]
GHA_Test[".github/workflows/test.yml"] --> FE_Tests["Jest"]
GHA_Test --> BE_Tests["Pytest"]
GHA_Build[".github/workflows/build.yml"] --> Docker_BE["backend/Dockerfile"]
GHA_Deploy[".github/workflows/deploy.yml"] --> Docker_BE
GHA_Migrate[".github/workflows/migrate.yml"] --> BE_Alembic["Alembic"]
```

**Источники диаграммы**
- [backend/requirements.txt:1-42](file://backend/requirements.txt#L1-L42)
- [frontend/package.json:1-60](file://frontend/package.json#L1-L60)
- [.github/workflows/test.yml](file://.github/workflows/test.yml)
- [.github/workflows/build.yml](file://.github/workflows/build.yml)
- [.github/workflows/deploy.yml](file://.github/workflows/deploy.yml)
- [.github/workflows/migrate.yml](file://.github/workflows/migrate.yml)
- [backend/Dockerfile:1-48](file://backend/Dockerfile#L1-L48)

**Источники раздела**
- [backend/requirements.txt:1-42](file://backend/requirements.txt#L1-L42)
- [frontend/package.json:1-60](file://frontend/package.json#L1-L60)

<a id="performance-considerations"></a>
## Производительность
- **Backend**
  - Асинхронные сессии SQLAlchemy, чтобы не блокировать I/O.
  - Настройка выборки (sampling) Sentry под окружение.
  - Rate limiting для защиты эндпоинтов.
  - В продакшене — Gunicorn с воркерами Uvicorn.
- **Frontend**
  - Кэш и `staleTime` в TanStack Query, меньше лишних запросов.
  - Эффективный рендер компонентов, без лишних перерисовок.
  - Умеренное использование утилит Tailwind для размера бандла.
- **База данных**
  - Индексы под частые фильтры и соединения.
  - Эволюция схемы через миграции Alembic.

*Для этого раздела отдельные ссылки на файлы не требуются — общие рекомендации.*

<a id="troubleshooting-guide"></a>
## Устранение неполадок
Типичные проблемы:
- **Нет подключения к БД**: проверить учётные данные, доступность сервиса и существование базы.
- **Ошибки загрузки Telegram WebApp**: HTTPS, корректный `WEBAPP_URL`, настройки CORS.
- **CORS**: правильно задать `ALLOWED_ORIGINS` (протоколы, несколько origin через запятую).
- **Sentry не ловит ошибки**: DSN и переменные окружения.

**Источники раздела**
- [docs/ENVIRONMENT_SETUP.md:122-141](file://docs/ENVIRONMENT_SETUP.md#L122-L141)

<a id="development-environment-setup"></a>
## Настройка среды разработки
Следуйте руководству по окружению: переменные бэкенда и фронтенда, секреты, базы и боты.

Кратко:
- Скопировать примеры `.env`, сгенерировать надёжный `SECRET_KEY`.
- PostgreSQL локально или управляемый сервис в продакшене.
- Настроить Telegram-бота и URL мини-приложения.
- Локально — Docker Compose и применение миграций Alembic.

**Источники раздела**
- [docs/ENVIRONMENT_SETUP.md:7-23](file://docs/ENVIRONMENT_SETUP.md#L7-L23)
- [docs/ENVIRONMENT_SETUP.md:36-52](file://docs/ENVIRONMENT_SETUP.md#L36-L52)
- [docs/ENVIRONMENT_SETUP.md:53-63](file://docs/ENVIRONMENT_SETUP.md#L53-L63)
- [README.md:47-64](file://README.md#L47-L64)

<a id="coding-standards-and-naming-conventions"></a>
## Стандарты кода и соглашения об именовании
- **Backend**
  - Модули: `api`, `middleware`, `models`, `schemas`, `services`, `tests`, `utils`.
  - Роутеры: множественное число (`users`, `workouts`).
  - Модели: PascalCase (`User`, `WorkoutLog`).
  - Pydantic-схемы: PascalCase и суффикс «Schema» (`UserCreateSchema`).
  - Функции: `snake_case`; константы: `UPPER_CASE`.
- **Frontend**
  - Компоненты: PascalCase; хуки: `useXxx`.
  - Расширения: `.tsx` для компонентов, `.ts` для хуков/сервисов/утилит.
  - Алиасы путей: `@/*`, `@components/*`, `@pages/*`, `@hooks/*`, `@stores/*`, `@services/*`, `@types/*`, `@utils/*`, `@styles/*`.
- **База данных**
  - Таблицы: существительные во множественном числе; колонки: `snake_case`; внешние ключи: `{дочерняя_сущность}_id`.

**Источники раздела**
- [frontend/tsconfig.json:23-51](file://frontend/tsconfig.json#L23-L51)
- [backend/app/models/base.py:1-7](file://backend/app/models/base.py#L1-L7)

<a id="code-formatting-and-linting"></a>
## Форматирование кода и линтинг
- **Backend**
  - Настройки pytest: пороги покрытия и ветвей.
  - Асинхронные тесты и корректные фикстуры.
- **Frontend**
  - ESLint с парсером TypeScript и плагином React.
  - Jest с ts-jest и DOM-окружением.
  - Tailwind и PostCSS в цепочке стилей.

**Источники раздела**
- [backend/pytest.ini:11-16](file://backend/pytest.ini#L11-L16)
- [frontend/package.json:9-9](file://frontend/package.json#L9-L9)
- [frontend/jest.config.js:1-44](file://frontend/jest.config.js#L1-L44)
- [frontend/tailwind.config.js:1-349](file://frontend/tailwind.config.js#L1-L349)
- [frontend/postcss.config.js:1-7](file://frontend/postcss.config.js#L1-L7)

<a id="testing-requirements"></a>
## Требования к тестированию
- **Покрытие (backend)**: порог задан в `pytest.ini` (`--cov-fail-under`, сейчас 51%); учитываются ветки (`--cov-branch`). Для фронтенда — см. `jest.config.js`.
- **Категории**: unit, integration, auth, slow.
- **Frontend**: Jest, DOM, пороги покрытия.
- **Backend**: Pytest в режиме asyncio, отчёты покрытия.

**Источники раздела**
- [backend/pytest.ini:17-22](file://backend/pytest.ini#L17-L22)
- [backend/pytest.ini:30-36](file://backend/pytest.ini#L30-L36)
- [frontend/jest.config.js:30-37](file://frontend/jest.config.js#L30-L37)

<a id="soft-delete-policy"></a>
## Soft delete policy (обратимое удаление)
Эта политика задаёт **единый, предсказуемый способ “удалять” сущности без физического удаления** там, где это должно быть обратимо или безопасно для аналитики.

### Термины
- **Soft delete**: логическое удаление сущности, запись остаётся в БД, по умолчанию скрыта из “активных” выборок и может быть восстановлена.
- **Archive**: скрыть сущность из UI/активных сценариев, но считать её “существующей” (например, скрытый шаблон или упражнение). Архив — это не удаление.
- **Hard delete**: физическое удаление строки (в этой политике допускается только для технических/временных данных и по отдельным правилам).

### Стандартные поля
Для сущностей, где удаление должно быть обратимым или безопасным для аналитики, используем **один стандарт**:
- **`deleted_at TIMESTAMPTZ NULL`**: основной признак soft delete. `NULL` = активная запись, не `NULL` = удалена.
- **опционально `deleted_by_user_id UUID NULL`**: кто удалил (если есть понятие пользователя/актора).
- **опционально `deleted_reason TEXT NULL`**: причина/категория (например: `user_request`, `moderation`, `fraud`, `system_cleanup`).

Не используем как основной механизм:
- `is_deleted BOOLEAN` (только если это уже legacy и его нельзя быстро заменить; новые таблицы так не делаем).
- перегрузку `is_archived` как “удалено” (архивирование и удаление — разные действия).

### Поведение запросов “по умолчанию”
- **Продуктовые выборки** (UI, API для обычных сценариев): всегда фильтруем `deleted_at IS NULL`.
- **Админ/поддержка**: отдельные эндпоинты/параметры, явно включающие удалённые (`include_deleted=true`) и/или только удалённые (`only_deleted=true`).
- **Аналитика**:
  - базовые метрики “активного продукта” обычно исключают удалённые (`deleted_at IS NULL`);
  - метрики ретеншна/истории должны уметь учитывать удалённые (важно различать “удалено” и “никогда не существовало”).

### Уникальность, индексы и “повторное создание”
Если у сущности есть “естественная” уникальность среди активных записей (например `slug`, `email`, “(user_id, slug)”):
- В Postgres **обязателен частичный уникальный индекс** вида:
  - `UNIQUE (...) WHERE deleted_at IS NULL`
- Это гарантирует:
  - нельзя создать дубль среди активных записей;
  - можно soft-delete запись и создать новую с тем же ключом (или восстановить при отсутствии конфликта).

Важно: составной `UNIQUE(key, deleted_at)` **не решает задачу** в Postgres из‑за семантики `NULL` (несколько `NULL` допускаются), поэтому для “уникально среди активных” применяем именно **partial unique index**.

### Связи, внешние ключи и каскады
Soft delete не должен “тихо” удалять полграфа данных.
- **FK `ON DELETE CASCADE`** используем только там, где родитель физически никогда не удаляется (или где таблица техническая и допускает hard delete по политике).
- Для связей, где бизнес‑смысл важен для истории/аналитики:
  - предпочитаем `ON DELETE RESTRICT` или `SET NULL`;
  - soft delete родителя **не приводит** к автоматическому удалению детей, вместо этого дети остаются как исторические факты.

### Восстановление (restore)
Restore — это операция, симметричная удалению:
- `restore` устанавливает `deleted_at = NULL` (и очищает `deleted_by_user_id/deleted_reason`, если вы их используете).
- Перед restore проверяем конфликт уникальности “среди активных” (см. partial unique index); при конфликте:
  - либо ошибка (409/422),
  - либо явная процедура “merge/rename” по бизнес‑правилам (не молча).

### Аналитика: “безопасное удаление”
Для фактовых/исторических данных (тренировки, подходы, события, оплаты и т.п.) базовый принцип:
- **не теряем факты физическим удалением**, если это ломает историю.

Рекомендации:
- Если требуется “удаление” факта пользователем, используем soft delete (`deleted_at`) + по возможности **событийный след** (audit/event log) о DELETE/UPDATE, чтобы аналитика могла воспроизводить историю изменений.
- Если нужно реально “стереть” по регуляторике (GDPR/право на удаление), делаем отдельный **процесс purge** (фоновой job), который:
  - физически удаляет/анонимизирует данные по списку таблиц,
  - документирован, наблюдаем, и запускается только по явному основанию.

### Когда soft delete НЕ нужен
Soft delete не обязателен (и часто вреден) для:
- промежуточных/временных таблиц (очереди, кэши, токены, одноразовые сессии),
- производных данных, которые полностью пересчитываются,
- данных, которые по бизнесу должны исчезать без следа (но тогда это должен быть осознанный hard delete с аналитическими оговорками).

### Чеклист при добавлении новой сущности
- есть ли у сущности требования “восстановить” или “не ломать аналитику”?
  - да → добавь `deleted_at` и правила из этой политики;
- проверь “уникально среди активных” → сделай partial unique index `... WHERE deleted_at IS NULL`;
- убедись, что “обычные” запросы исключают `deleted_at IS NOT NULL`;
- определись, это **archive** (`is_archived`) или **delete** (`deleted_at`) — не смешивай.

<a id="database-migrations-standard"></a>
## Стандарт миграций БД (Alembic)
Этот раздел фиксирует единые правила для миграций схемы и данных в FitTracker Pro (PostgreSQL + Alembic). Цель — предсказуемые деплои без ручных операций и без “ломающих” миграций.

### Термины
- **Schema migration**: изменение структуры (таблицы/колонки/индексы/constraint’ы/enum’ы).
- **Data migration**: изменение данных (backfill, дедупликация, пересчёт, преобразование формата).
- **Forward-only**: политика, при которой миграции в продакшене считаются необратимыми “в один шаг”, а откат делается новой миграцией (roll-forward fix).

### Naming / структура именования
- **Файл миграции**: `{revision}_{slug}.py`, где:
  - `revision` — автогенерируемый Alembic идентификатор;
  - `slug` — короткое описание в `snake_case`, без общих слов вроде `update`/`fix`.
  - пример: `9f1c2a3b4d5e_add_workout_source_index.py`
- **revision message** (сообщение в `alembic revision -m`): `db: <краткое действие>`, пример: `db: add partial unique index for users email`.
- **Именование объектов в БД** (единый стиль, чтобы легче искать/диффать):
  - **индексы**: `ix__{table}__{col1}__{col2}` (для partial можно добавлять `__active`, `__not_deleted` и т.п.)
  - **уникальные constraint’ы**: `uq__{table}__{col1}__{col2}`
  - **foreign key**: `fk__{table}__{col}__{ref_table}`
  - **check constraint**: `ck__{table}__{rule_slug}`
  - если Alembic/SQLAlchemy генерирует имя автоматически, в миграции предпочитаем **явно задавать `name=`**.

### Политика отката: forward-only по умолчанию
- **Default**: миграции проектируем как **forward-only** для продакшена.
- **Откат релиза** делается через:
  - новый PR с новой миграцией, которая “чинит вперёд” (например, возвращает колонку/индекс/значения), или
  - откат приложения без отката схемы (только если схема была изменена совместимо).

Когда допустим осознанный `downgrade()`:
- только если это **чисто схемное** изменение без потери данных и без зависимости от уже записанных данных;
- `downgrade()` должен быть действительно рабочим, а не “pass”.

### Правила совместимости (двухфазные изменения)
Для изменений, которые потенциально ломают старый код, используем **expand/contract**:
- **Expand (совместимо)**:
  - добавить колонку nullable (или с дефолтом, если это безопасно),
  - добавить новую таблицу,
  - добавить индекс/constraint, который не ломает существующие записи (или после backfill),
  - добавить новый enum value (с оговорками, см. ниже).
- **Migrate data (backfill)**: заполнить новые поля/таблицы.
- **Contract (ломающее)**:
  - сделать колонку NOT NULL,
  - удалить старые колонки/таблицы,
  - ужесточить constraint’ы.

### Data migrations (миграции данных)
Правило по умолчанию: **не делать тяжёлые data migrations внутри Alembic как часть обычного деплоя**, если это может:
- занимать минуты/часы,
- брать эксклюзивные блокировки,
- раздувать WAL/репликацию,
- приводить к таймаутам и аварийному откату деплоя.

Рекомендованные стратегии:
- **Небольшой backfill** (до “безопасного” объёма): допускается в `upgrade()`, но:
  - обновления батчами (chunking) по первичному ключу,
  - без долгих транзакций (по возможности),
  - без `SELECT *` и без полного сканирования без индекса.
- **Большой backfill**: выносить в отдельную управляемую джобу/скрипт (Celery/management command), который можно:
  - запускать отдельно,
  - мониторить прогресс,
  - безопасно перезапускать (idempotent),
  - при необходимости — троттлить.

Ключевые требования к data migrations:
- **Идемпотентность**: повторный запуск не должен портить данные.
- **Версионирование логики**: миграция данных не должна зависеть от “текущего” Python-кода, который поменяется после релиза; в Alembic используем SQL/минимально достаточную логику.
- **Проверяемость**: добавляем простые SQL-инварианты (до/после), которые можно выполнить вручную или в CI.

### Опасные операции и как их делать безопасно
- **Добавление NOT NULL**: сначала expand (nullable) + backfill + проверка + contract (NOT NULL).
- **Переименование**: prefer add-new + backfill + switch code + drop-old (в отдельной миграции), вместо “rename колонку и всё”.
- **Индексы на больших таблицах**:
  - в Postgres часто нужен `CREATE INDEX CONCURRENTLY` (учтите, что он **нельзя** выполнять внутри транзакции; Alembic требует `op.get_context().autocommit_block()`).
  - если проект/окружение не поддерживает concurrent-индексы в пайплайне — фиксируем это как ограничение и не делаем такие миграции без отдельного плана.
- **Enum** (Postgres):
  - добавление значения возможно как expand;
  - удаление/переименование значений требует отдельной процедуры (обычно через новый тип) — не делать “на бегу” без плана.

### Правила review миграций (чеклист)
Каждый PR с миграциями должен пройти проверку:
- **Безопасность/блокировки**: нет ли длительных эксклюзивных lock’ов (особенно `ALTER TABLE ... TYPE`, `DROP COLUMN`, массовый `UPDATE`).
- **Совместимость**: есть ли окно, где старая версия приложения и новая схема могут жить вместе (expand/contract).
- **Производительность**: индексы под новые запросы; нет ли полного сканирования/массовых обновлений без индекса.
- **Именование**: явные `name=` для constraint’ов/индексов, понятный slug.
- **Data migration**: объём, chunking, идемпотентность, нет ли зависимости от “живого” кода.
- **Downgrade**: либо корректный `downgrade()` (если он заявлен), либо явно forward-only (и это ок).
- **Порядок выката**: если есть contract-часть (удаления/NOT NULL), она должна быть отдельным шагом после backfill и после выката кода.

<a id="adding-new-features-and-modifying-functionality"></a>
## Добавление функций и изменение поведения
- **Backend**
  - Новый роутер в `app/api`, подключение в `main.py`.
  - Схемы Pydantic в `app/schemas`.
  - Модели в `app/models` и миграции.
  - Тесты в `app/tests`.
- **Frontend**
  - Страницы и компоненты в `src/pages` и `src/components`.
  - Данные через TanStack Query.
  - Маршруты в `src/App.tsx`.
  - Юнит-тесты в `src/__tests__`.
- **База данных**
  - После изменения схемы — сгенерировать и применить миграции Alembic.

**Источники раздела**
- [backend/app/main.py:89-107](file://backend/app/main.py#L89-L107)
- [frontend/src/App.tsx:12-29](file://frontend/src/App.tsx#L12-L29)

<a id="backward-compatibility-guidelines"></a>
## Обратная совместимость
- **Версии API**: базовый путь `/api/v1`; ломающие изменения — новая версия API.
- **Устаревание**: помечать устаревшие эндпоинты и обновлять документацию.
- **Схема БД**: менять через Alembic без потери данных где возможно.
- **Frontend**: не удалять публичные API компонентов/функций без предупреждения об устаревании.

**Источники раздела**
- [backend/app/main.py:56-75](file://backend/app/main.py#L56-L75)

<a id="pull-request-process-and-code-review-standards"></a>
## Pull request и код-ревью
- **Ветки**: `feature/краткое-описание`, `fix/номер-issue`.
- **Чек-лист PR**:
  - Тесты проходят, покрытие не ниже порогов.
  - Линтинг фронтенда и бэкенда без ошибок.
  - Нет отладочных `console.log` и флагов в продакшен-коде.
  - Изменения отражены в документации или комментариях.
  - Проверка безопасности: аутентификация и секреты.
- **Ревью**:
  - Ясная формулировка задачи и решения.
  - Тесты на новую логику.
  - Оценка влияния на производительность.
  - Доступность (a11y) и интернационализация при необходимости.

*Отдельные ссылки на файлы не требуются — общие правила.*

<a id="documentation-standards"></a>
## Стандарты документации
- Комментарии в коде: объяснять **зачем**, а не **что**.
- README: новые возможности, эндпоинты, переменные окружения.
- API: OpenAPI от FastAPI — актуальные примеры.
- Архитектурные решения: заметки в `docs/` в духе ADR.

**Источники раздела**
- [README.md:130-177](file://README.md#L130-L177)

<a id="commit-message-conventions"></a>
## Сообщения коммитов
- Префиксы: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `revert:`.
- Тема: кратко, повелительное наклонение, до ~50 символов.
- Тело: мотивация и суть изменений; ссылки на issue.

*Отдельные ссылки на файлы не требуются.*

<a id="release-procedures"></a>
## Выпуск релизов
- **CI/CD**
  - `test.yml`: тесты и покрытие.
  - `build.yml`: сборка Docker-образов.
  - `migrate.yml`: миграции Alembic.
  - `deploy.yml`: продакшен через `docker-compose.prod.yml`.
- **Перед релизом**
  - Проверить переменные окружения и секреты.
  - Убедиться, что миграции применены.
  - Проверить документацию API и health-эндпоинты.
- **После релиза**
  - Мониторинг ошибок в Sentry.
  - Дашборды Prometheus/Grafana.

**Источники раздела**
- [.github/workflows/test.yml](file://.github/workflows/test.yml)
- [.github/workflows/build.yml](file://.github/workflows/build.yml)
- [.github/workflows/migrate.yml](file://.github/workflows/migrate.yml)
- [.github/workflows/deploy.yml](file://.github/workflows/deploy.yml)
- [README.md:178-202](file://README.md#L178-L202)

<a id="debugging-profiling-and-performance-optimization"></a>
## Отладка, профилирование и оптимизация
- **Backend**
  - `DEBUG` в разработке; отключить в продакшене.
  - Sentry для ошибок и профилирования.
  - Rate limiting против злоупотреблений.
  - Оптимизация запросов и индексов.
- **Frontend**
  - React DevTools и React Query Devtools.
  - Размер бандла (анализатор сборки Vite).
  - Тяжёлые вычисления вне горячего пути рендера.
- **Мониторинг**
  - Метрики Prometheus и дашборды Grafana.

**Источники раздела**
- [backend/app/main.py:28-43](file://backend/app/main.py#L28-L43)
- [backend/Dockerfile:43-47](file://backend/Dockerfile#L43-L47)
- [docs/ENVIRONMENT_SETUP.md:112-121](file://docs/ENVIRONMENT_SETUP.md#L112-L121)

<a id="conclusion"></a>
## Заключение
Эти правила помогают выстроить единый процесс разработки, поддерживать качество кода и стабильную эксплуатацию. Участникам стоит придерживаться принятых паттернов, сохранять обратную совместимость и следовать описанным шагам для окружения, тестов, ревью и релизов.

*Итог без привязки к конкретным файлам — отдельные источники не указаны.*
