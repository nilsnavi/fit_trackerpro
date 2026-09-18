# FitTracker Pro

Telegram Mini App для тренировок, здоровья и аналитики.

## Быстрый старт

Каноническая шпаргалка: [**QUICKSTART.md**](./QUICKSTART.md) (Docker, env, проверка URL).

Дополнительно:

- [**Launch readiness checklist**](./docs/checklists/launch-readiness.md) — чеклист готовности
- [**LAUNCH_GUIDE.md**](./LAUNCH_GUIDE.md) — развёрнутая инструкция

---

## Документация (entrypoint)

- `docs/README.md` — индекс и навигация по документации (канон)
- `docs/local-development.md` — локальная разработка
- `docs/DEPLOYMENT.md` — production деплой
- `docs/architecture.md` — архитектура
- `docs/security.md` — безопасность
- `docs/offline-pwa.md` — офлайн и PWA

## Source of truth (коротко)

- **Деплой**: `.github/workflows/deploy.yml` + `docker-compose.prod.yml` (и `docs/DEPLOYMENT.md`)
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

Канонический гайд: `docs/DEPLOYMENT.md`.

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
- `/api/v1/progression/*` — политики, рекомендации, lifecycle и история прогрессии. Принятая (`accepted`/`modified`) рекомендация подставляется в новую сессию: черновик открывается на принятом весе (например, `82.5` вместо `80`) в рамках того же слота шаблона, а «Повторить тренировку» — вместо весов исходной сессии. Если исходная сессия была без шаблона (быстрый старт), используется scope `пользователь + упражнение`; в быстром старте упражнение, добавленное в сессию, тоже получает принятую цель — но только в пустые подходы, всё, что пользователь ввёл сам, никогда не перетирается. Сам шаблон при этом не изменяется, а непринятая (`generated`) рекомендация не подставляет ничего. В интерфейсе такой подход помечен («вес подставлен принятой целью прогрессии» плюс плановое значение) и откатывается одним тапом: подходы возвращаются к плановым числам, и откат больше не перетирается повторной подстановкой. Отказ запоминается в самой рекомендации (`prefill_declined`): цель остаётся принятой и видимой, но больше не подставляется в новые тренировки. Такие цели собираются в одном месте: `GET /api/v1/progression/prefill` (фильтр `declined_only`) и `POST /api/v1/progression/prefill/{id}/enable|disable` питают экран «Цели прогрессии» (профиль → настройки), где показаны все принятые цели с переключателем автоподстановки в обе стороны. На этом же экране цель редактируется целиком: `PATCH /api/v1/progression/prefill/{id}` меняет значение (`value`), тип политики (`type`) и диапазон повторов (`reps_min`/`reps_max`), причём пишутся только присланные поля, а политика ложится в scope самой цели — унаследованная (уровня шаблона или пользователя) сначала материализуется в этот слот, поэтому правка не роняет остальные параметры и не задевает другие слоты одного упражнения. Записанная в рекомендации политика остаётся историей: текущая отдаётся отдельно в `effective_policy` (вместе с `effective_increment`), и именно она определяет единицы — цель с политикой `TIME_PROGRESSION` подставляется в секунды. Автоподстановка при правке не переключается сама: выключенная цель остаётся выключенной. Автоподстановка также включается снова сама, если принять новую цель. После цикла тренировок список длинный, поэтому тот же экран работает и пачками: `POST /api/v1/progression/prefill/bulk-disable` выключает подстановку у выбранных целей или (если `recommendation_ids` не передан) у всех текущих — их резолвит сервер тем же ранжированием «самая новая цель на scope», так что «выключить всем» не задевает перекрытую историю; `POST /api/v1/progression/prefill/bulk-update` применяет к выбранным одну политику и/или диапазон повторов (`type`, `reps_min`, `reps_max`), проверяя итоговый диапазон каждой цели до первой записи, — значения, lifecycle и переключатели подстановки пачечная правка не трогает. В ответе обе ручки отдают `updated`/`skipped`/`applied_to_all`, причём `skipped` — это не числа, а объяснения: на каждую пропущенную цель `recommendation_id`, причина (`reason`: `not_found` — цель неизвестна, чужая или уже не является принятой, `already_disabled` — подстановка была выключена раньше) и, если запись ещё существует, её имя, значение, единицы и `scope_key`. Сервер отдаёт их тем же батчем (два запроса на весь список, без N+1), а единицы берёт из текущей политики scope, поэтому пояснение читается так же, как строка списка. Экран показывает результат последней пачечной операции отдельным блоком: сколько целей изменилось и список пропущенных с именем и причиной (счёт в тосте остаётся только сводкой), при этом блок держится, пока пользователь его не закроет или не запустит следующую операцию.
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

Единый источник версий — только файлы в `backend/requirements/` (не дублировать списки в `pyproject.toml`; там настроен Ruff и комментарий-напоминание).

- Основные зависимости: `backend/requirements/base.txt`
- Зависимости для разработки и тестов: `backend/requirements/dev.txt` (включает `base.txt`)
- Зависимости для production-образа: `backend/requirements/prod.txt` (включает `base.txt`)
- Корневой `backend/requirements.txt` подключает dev-набор для локальной установки (`pip install -r requirements.txt` из каталога `backend`)

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
