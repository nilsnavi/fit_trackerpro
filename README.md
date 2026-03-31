# FitTracker Pro

Telegram Mini App для тренировок, здоровья и аналитики.

## Быстрый старт (Docker)

Репозиторий: [github.com/nilsnavi/fit_trackerpro](https://github.com/nilsnavi/fit_trackerpro) (для форка используйте URL своего remote).

```bash
git clone https://github.com/nilsnavi/fit_trackerpro.git
cd fit_trackerpro

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

В `backend/.env` обязательно задайте `SECRET_KEY` (например: `openssl rand -hex 32` в Unix/macOS или `python -c "import secrets; print(secrets.token_hex(32))"`). При необходимости укажите `TELEGRAM_BOT_TOKEN` и остальные поля по комментариям в файле.

Поднять весь стек (переменные для подстановки в `docker-compose.yml` берутся из `backend/.env` и `frontend/.env`):

```bash
docker compose --env-file backend/.env --env-file frontend/.env up -d --build
docker compose --env-file backend/.env --env-file frontend/.env exec backend alembic upgrade head
```

Если у вас установлен старый бинарь, замените `docker compose` на `docker-compose`.

Доступ:

- Фронтенд (Nginx): `http://localhost`
- API бэкенда: `http://localhost:8000/api/v1`
- Swagger (при `DEBUG=true` у бэкенда): `http://localhost:8000/docs`

## Настройка для разработки

### Вариант A — как в разделе «Быстрый старт»

Полный стек через Docker Compose (см. выше). Код бэкенда смонтирован в контейнер (`./backend:/app`), правки подхватываются при перезапуске процесса внутри контейнера в зависимости от режима запуска.

### Вариант B — бэкенд и фронтенд на хосте, БД в Docker

Требования: **Python 3.11+**, **Node.js 20+**, **PostgreSQL 15**, **Redis 7**.

1. Только инфраструктура:

   ```bash
   docker compose up -d postgres redis
   ```

2. Бэкенд:

   ```bash
   cd backend
   python -m venv .venv
   # Windows: .venv\Scripts\activate
   # Unix/macOS: source .venv/bin/activate
   pip install -r requirements/dev.txt
   cp .env.example .env
   # В .env: DATABASE_* и REDIS_URL на localhost (как в .env.example), SECRET_KEY, TELEGRAM_*
   alembic upgrade head
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. Фронтенд (в другом терминале):

   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # VITE_API_URL=http://localhost:8000/api/v1
   npm run dev
   ```

Vite по умолчанию: `http://localhost:5173`. В `backend/.env` добавьте этот origin в `ALLOWED_ORIGINS` (уже есть `http://localhost:5173` в примере).

## Настройка боевого окружения (production)

- **Образы:** `ghcr.io/<GITHUB_REPOSITORY>/backend:<tag>` и `ghcr.io/<GITHUB_REPOSITORY>/frontend:<tag>`, где `<GITHUB_REPOSITORY>` — slug репозитория в формате `владелец/имя` (для этого репозитория: `nilsnavi/fit_trackerpro`). Теги собирает workflow [`.github/workflows/build.yml`](.github/workflows/build.yml): ветка/SHA, semver при релизе; **в production не используется `:latest`** — в `docker-compose.prod.yml` задано `IMAGE_TAG` (версионированный тег или `main-<sha>`).
- **Compose:** [`docker-compose.prod.yml`](docker-compose.prod.yml) — инфраструктурные образы (Postgres, Redis, Nginx) закреплены по digest; приложения — из GHCR по `IMAGE_TAG`. Postgres и Redis во внутренней сети, наружу обычно смотрит **Nginx** (порты `80`/`443`). В `.env` на сервере нужны переменные из [`backend/.env.production.example`](backend/.env.production.example), включая `GITHUB_REPOSITORY` и `IMAGE_TAG` (их записывает деплой из GitHub Actions).
- **TLS:** положите сертификаты в `nginx/ssl` и проверьте [`nginx/nginx.conf`](nginx/nginx.conf).
- **Деплой из CI:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — по событию **release** или вручную (**workflow_dispatch**); на сервер синхронизируются `docker-compose.prod.yml` и `nginx/nginx.conf`, каталог приложения по умолчанию `~/fittracker-pro`. На сервере после настройки `.env` (как в шагах workflow): `docker-compose -f docker-compose.prod.yml pull` → `docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head` → `docker-compose -f docker-compose.prod.yml up -d`. С Docker Compose V2 те же команды через `docker compose ...`.

Проверки после выката: проверка живости `GET /api/v1/system/health` (или короткий алиас `GET /health` — тот же JSON), `GET /api/v1/system/version`, ответ фронта через прокси (как в сценарии деплоя в GitHub Actions).

## Обзор архитектуры

### Фронтенд

- `frontend/src/app` — загрузка приложения, роутер, провайдеры, лейауты
- `frontend/src/features` — домены (`workouts`, `exercises`, `profile`, `health`, `analytics`, `achievements`, `home`, `emergency`)
- `frontend/src/shared` — общие типы и утилиты между доменами
- `frontend/src/pages` — страницы пользовательских сценариев (без дублирующих экранов по типам)

Ключевые принципы:

- **TanStack Query** — состояние с сервера
- **Zustand** — только локальное состояние UI, сессии и черновиков
- Режимы тренировок рендерятся **по конфигурации** через `WorkoutTypeConfig`

### Бэкенд

- `backend/app/api` — HTTP (роутеры, валидация, маппинг ошибок)
- `backend/app/application` — сценарии и оркестрация (сценарии использования / «сервисы»)
- `backend/app/domain` — сущности и доменные исключения
- `backend/app/infrastructure` — БД (engine/session), репозитории, кэш, интеграции (Telegram initData и т.д.)
- `backend/app/schemas` — Pydantic DTO для API

## PWA и офлайн

Фронтенд собирается как **прогрессивное веб-приложение (PWA)** через [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox). Манифест лежит в [`frontend/public/manifest.webmanifest`](frontend/public/manifest.webmanifest) (`display: standalone`, иконки, ярлыки shortcuts).

### Как это работает

- **Service Worker** генерируется при **production-сборке** (`npm run build`). В режиме разработки (`npm run dev`) PWA **отключена** (`devOptions.enabled: false`), чтобы не мешать горячей подмене модулей (HMR).
- **Регистрация SW** — автоматическая (`injectRegister: 'auto'`). Новая версия SW **не активируется сама**: используется режим `registerType: 'prompt'` — пользователь видит баннер «Доступна новая версия» и сам нажимает «Обновить» ([`PwaUpdatePrompt`](frontend/src/app/components/PwaUpdatePrompt.tsx)). Это снижает риск смешения старых и новых чанков в одной сессии.
- **Навигация SPA:** запросы к маршрутам приложения (кроме `/api/…`) при отсутствии сетевого ответа отдают закешированный `index.html` (`navigateFallback`); пути API в fallback **не попадают** (`navigateFallbackDenylist`).

### Что кеширует Service Worker

1. **Предзагрузка в кеш (precache, установка SW)** — файлы из билда по маскам: `*.js`, `*.css`, `*.html`, иконки, `manifest.webmanifest`, шрифты, растровая/векторная графика и т.д. (см. `globPatterns` в [`frontend/vite.config.ts`](frontend/vite.config.ts)). Туда же попадают ассеты из `includeAssets` (`vite.svg`, `icons/**/*.png`). Файлы больше **5 МБ** в precache не попадают (`maximumFileSizeToCacheInBytes`).
2. **Кеши во время работы** (для уже посещённого origin, порядок правил важен):
   - **Шрифты** (`pwa-fonts`) — сначала кеш (Cache First), до ~1 года.
   - **JS** под `/assets/*.js` — устаревший с фоновым обновлением (Stale While Revalidate), до 7 дней.
   - **CSS** под `/assets/*.css` — устаревший с фоновым обновлением, до 7 дней.
   - **Иконки и картинки** (в т.ч. `icons/`, `vite.svg`, изображения в `assets`) — сначала кеш, до 30 дней.

**API бэкенда** (`/api/v1/…`) Workbox **специально не кеширует** — ответы идут только по сети (или из логики приложения ниже).

### Что доступно без сети (после хотя бы одного успешного визита)

- **Оболочка приложения** — HTML, бандлы и статика из precache/runtime: интерфейс открывается, роутинг на клиенте.
- **Последние известные данные в TanStack Query** (persist в `localStorage`, ключ `fittracker_rq_offline_v1`, до ~7 дней): каталог упражнений, справочники (`reference`), **история тренировок** и **шаблоны** (см. [`offlineQueryPersist`](frontend/src/shared/offline/offlineQueryPersist.ts)). Профиль и прочие чувствительные ключи **не** сохраняются в persist.
- **Очередь мутаций по тренировкам** — старт/завершение тренировки, создание/обновление шаблонов могут ставиться в очередь и синхронизироваться при появлении сети ([`workoutOfflineEnqueue`](frontend/src/shared/offline/workoutOfflineEnqueue.ts), `SyncQueueRunner`).

### Ограничения

- Без предварительного онлайн-визита **нет** полноценного «холодного» офлайна: нечего положить в precache и в persist.
- **Не кешируются и не сохраняются для офлайна** целиком: аналитика, метрики здоровья, профиль и остальные разделы вне перечисленных ключей запросов — обращения к API **завершатся ошибкой** без сети, если нет сохранённого успешного ответа в памяти сессии.
- Service Worker кеширует **статику своего origin**; если API на другом хосте, это не меняет правило: ответы API не в SW.
- Ограничение **5 МБ** на файл в precache: очень тяжёлый ассет может не попасть в precache.
- В **режиме разработки** PWA не активна — поведение как у обычного Vite-приложения.

## Структура API (v1)

**Платформа (публично, без пользовательских данных)**

| Назначение | Метод и путь | Тело ответа |
|------------|----------------|-------------|
| Проверка живости (канонический URL в OpenAPI) | `GET /api/v1/system/health` | `{"status":"healthy"}` |
| Тот же контракт для проб (Docker, внутренние проверки) | `GET /health` | `{"status":"healthy"}` |
| Версия и сборка | `GET /api/v1/system/version` | `name`, `version`, `commit_sha`, `build_timestamp` |

**Доменные маршруты**

- `/api/v1/health-metrics/*`
- `/api/v1/analytics/*`
- `/api/v1/analytics/achievements/*`
- `/api/v1/analytics/challenges/*`
- `/api/v1/workouts/*`
- `/api/v1/exercises/*`
- `/api/v1/users/*`
- `/api/v1/users/auth/*`

### Устаревшие алиасы (устарело)

Старые маршруты пока доступны для обратной совместимости и помечены как устаревшие:

- `/api/v1/auth/*` → используйте `/api/v1/users/auth/*`
- `/api/v1/achievements/*` → используйте `/api/v1/analytics/achievements/*`
- `/api/v1/challenges/*` → используйте `/api/v1/analytics/challenges/*`
- `/api/v1/emergency/*` → используйте `/api/v1/system/emergency/*`

План удаления: устаревшие алиасы будут убраны в `v1.2.0` (ориентировочная дата `2026-06-30`).

## Критические изменения

- Эндпоинт проверки здоровья системы перенесён с `/api/v1/health` на `/api/v1/system/health`.
- Новый эндпоинт версии системы: `/api/v1/system/version`.
- Пользовательские метрики здоровья теперь под `/api/v1/health-metrics/*`.
- Отдельные экраны по типу тренировки заменены на рендер по конфигурации (`WorkoutModePage` + `WorkoutTypeConfig`).

Стратегия health-эндпоинтов:

- `system/*` и алиас `GET /health` — техническое состояние API (один JSON-контракт проверки живости)
- `health-metrics/*` — пользовательские метрики здоровья

Nginx (`/health` на хосте) и образ бэкенда проксируют/запрашивают тот же ответ, что и `GET /api/v1/system/health`.

## Стратегия окружений

### Разработка

- `docker-compose.yml`
- Разрешены локальные порты Postgres/Redis
- Обязателен `SECRET_KEY` (без небезопасного значения по умолчанию)

### Боевое окружение (production)

- `docker-compose.prod.yml`
- Приложение разворачивается из Docker-образов в GHCR (`ghcr.io/<GITHUB_REPOSITORY>/...`)
- Postgres/Redis не публикуются наружу
- На старте бэкенда проверяется корректность переменных окружения:
  - `SECRET_KEY` не короче 32 символов в production
  - `ALLOWED_ORIGINS` не может быть `*`
  - `DEBUG=false` в production

## Стратегия зависимостей (бэкенд)

- Основные зависимости: `backend/requirements/base.txt`
- Зависимости для разработки: `backend/requirements/dev.txt`
- Зависимости для production: `backend/requirements/prod.txt`
- Точка совместимости: `backend/requirements.txt` → `-r requirements/dev.txt`

Все ключевые зависимости зафиксированы по точным версиям (pin).

## Источник правды по деплою

- Артефакты сборки: образы в GHCR (`backend` и `frontend`)
- Оркестрация выката: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) + `docker-compose.prod.yml`
- На сервере выполняется `docker compose pull` (или `docker-compose pull`) и `up -d` согласно workflow

## Стратегия миграций

- Перед деплоем выполняется резервное копирование БД (по возможности)
- Миграции выполняются отдельным шагом `alembic upgrade head`
- Ошибка миграции **останавливает деплой** (без `|| true`)
- После деплоя выполняются проверки:
  - `GET /health` или `GET /api/v1/system/health` (эквивалентный JSON)
  - `GET /api/v1/system/version`
  - дымовая проверка через `http://localhost/` на хосте приложения

### Политика схемы БД (source of truth)

- **Source of truth**: SQLAlchemy модели (`backend/app/domain/*`) + Alembic миграции (`database/migrations`).
- **Legacy/архив схем** (не используются runtime): `docs/db/legacy/*`.
- Подробная политика: `docs/db/schema-governance.md`.

## CI/CD

Сценарии в [`.github/workflows/`](.github/workflows/):

- [`test.yml`](.github/workflows/test.yml) — тесты и проверки
- [`build.yml`](.github/workflows/build.yml) — сборка и push Docker-образов в GHCR
- [`deploy.yml`](.github/workflows/deploy.yml) — выкат в боевое окружение и проверка здоровья
- [`migrate.yml`](.github/workflows/migrate.yml) — операции с миграциями
- [`security.yml`](.github/workflows/security.yml) — проверки безопасности
- [`dependabot-automerge.yml`](.github/workflows/dependabot-automerge.yml) — автослияние Dependabot (при настроенных правилах)

## Мониторинг

- Sentry
- Prometheus
- Grafana

```bash
cd monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

## Лицензия

MIT
