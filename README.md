# FitTracker Pro

Telegram Mini App для тренировок, здоровья и аналитики.

## 🚀 Быстрый старт

**Хотите запустить прямо сейчас?** Смотрите:

- [**QUICKSTART.md**](./QUICKSTART.md) - запуск за 3 команды ⚡
- [**CHECKLIST.md**](./CHECKLIST.md) - полный чеклист готовности ✅
- [**LAUNCH_GUIDE.md**](./LAUNCH_GUIDE.md) - подробная инструкция 📖

---

## Документация (entrypoint)

- `docs/DOCS_INDEX.md` — индекс и навигация по документации (канон)
- `docs/local-development.md` — локальная разработка
- `docs/deployment.md` — production деплой
- `docs/architecture.md` — архитектура
- `docs/security.md` — безопасность
- `docs/offline-pwa.md` — офлайн и PWA

## Source of truth (коротко)

- **Деплой**: `.github/workflows/deploy.yml` + `docker-compose.prod.yml` (и `docs/deployment.md`)
- **Архитектура**: `docs/architecture.md` (backend-детали: `docs/architecture/backend.md`)
- **Окружения**: `docs/env-matrix.md` + `docs/ENVIRONMENT_SETUP.md`
- **Миграции**: `database/migrations` (политика: `docs/db/schema-governance.md`)

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

### Вариант A1 — Docker DEV (автообновление в контейнерах)

Для режима разработки с автоматическим подхватом изменений:

- backend: `uvicorn --reload`
- frontend: Vite HMR внутри контейнера

Запуск одной командой (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-up.ps1
```

Остановка одной командой (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-down.ps1
```

С ngrok для Telegram Mini App:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-up.ps1 -WithNgrok
```

Остановка DEV + ngrok:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-down.ps1 -WithNgrok
```

Локальные адреса DEV-режима:

- Frontend HMR: `http://localhost:18081`
- Edge (единая точка входа): `http://localhost:19000`
- Backend API: `http://localhost:18000/api/v1`

Примечание по миграциям: контейнер `fittracker-migrator` в этом проекте одноразовый. Нормальный статус после запуска — `exited (0)`.

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

Канонический гайд: `docs/deployment.md`.

## Обзор архитектуры

Канонический документ: `docs/architecture.md`.

## PWA и офлайн

Канонический документ: `docs/offline-pwa.md`.

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
