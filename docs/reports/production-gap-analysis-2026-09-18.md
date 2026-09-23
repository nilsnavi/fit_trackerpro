# Production gap analysis — FitTracker Pro

**Дата:** 2026-09-18
**Область анализа:** репозиторий `nilsnavi/fit_trackerpro`, коммит `e8fee2e` (HEAD `main`), GitHub Actions, `docker-compose.prod.yml`, frontend (React/Vite), backend (FastAPI), эксплуатационные артефакты.
**Метод:** чтение кода и конфигов + локальный прогон тестов/сборок + проверка состояния GitHub (runs, releases, environments).

---

## 0. Вердикт в двух строках

**Код готов к продакшену на ~85%: тесты зелёные, контракты синхронны, security-хардening выше среднего. Продукт — на ~70%: часть фич здоровья/безопасности реализована на бэкенде, но не подключена к UI, а одна (экстренная помощь) — опасная заглушка.**

**Главный блокер не в коде: приложение ни разу никуда не выкатывалось.** Deploy-пайплайн существует, но не запускался ни разу, GitHub Environments не созданы, релизов нет, образ для текущего `main` не собран (сборка отменена). Плюс две постоянно красных шедульных проверки (Security, E2E Smoke Real API).

---

## 1. Что реально проверено (доказательства)

| Проверка | Команда | Результат |
|---|---|---|
| Backend-тесты | `pytest` (все 23 файла тестов) | ✅ **290 passed, 4 skipped**, coverage **77%** |
| Frontend typecheck | `tsc --noEmit` | ✅ 0 ошибок |
| Frontend lint | `eslint --max-warnings 0` | ✅ 0 ошибок |
| Frontend unit/integration | `jest --ci` | ✅ **309 passed, 4 skipped** (48 suites) |
| Frontend coverage | `jest --coverage` | ⚠️ **20.8% lines**, 12.6% branches |
| Production-сборка фронта | `npm run build` | ✅ успешно, PWA precache 154 записи |
| Bundle budgets | `npm run bundle:check` | ✅ (при `BUNDLE_STATS=1`) |
| FE↔BE контракт | `npm run api:contract:check` | ✅ `API contract OK (OpenAPI types match)` |
| Boot API | ASGI + httpx | ✅ `/api/v1/system/health`, `/version`, `/health/live` → 200 |
| CI `Test` на main (2026-09-16) | GitHub Actions | ✅ **все 14 jobs success** (включая 6 E2E-наборов, миграции fresh+rollback) |
| CI `Security` на main | GitHub Actions | ❌ **failure** — `npm audit`, `pip-audit` |
| CI `E2E Smoke Real API` | GitHub Actions, ежедневно 03:00 | ❌ **failure** каждый день с 15.09 (шаг `Validate smoke environment`) |
| CI `Build and Push` на main | GitHub Actions | ❌ **cancelled** 2026-09-16 → для текущего `main` образа нет |
| GitHub Releases | `gh release list` | ❌ **пусто** (0 релизов) |
| Теги | `gh api .../tags` | ⚠️ 1 тег: `v2026.04.05-workouts-modal-standardization` |
| GitHub Environments | `gh api .../environments` | ❌ **`total_count: 0`** — ни `staging`, ни `production` не созданы |
| Запуски `deploy.yml` / `migrate.yml` / `rollback-production.yml` | `gh run list --workflow=...` | ❌ **ни одного запуска за всю историю** |

---

## 2. Сильные стороны (это уже можно не переделывать)

- **Архитектура чистая и соблюдена:** `api → application → domain ← infrastructure`, тонкие HTTP-роутеры, сервисы, репозитории, домены. 103 маршрута, единая точка регистрации (`registration.py`) с явными legacy-алиасами.
- **Безопасность:** валидация Telegram `initData` (HMAC + `auth_date`), JWT access/refresh, rate limiting (slowapi + Redis, graceful fallback), security headers, CORS-whitelist без wildcard, валидация production-настроек на старте (`reject_insecure_defaults_in_production`), gitleaks, CodeQL, Trivy, dependency-review в CI.
- **Надёжность:** idempotency-ключи + optimistic locking, dependency-aware readiness (`/api/v1/system/ready`, `/health/ready` → 503 при деградации), корреляционные ID и структурные логи, Sentry с редакцией заголовков, Prometheus-метрики.
- **Frontend:** реальный Telegram-auth-флоу с route guards, offline-first очередь синхронизации (IndexedDB + TanStack persist + конфликт-резолюция), PWA, бюджет бандла, code splitting, runtime-конфиг (`config.js`) вместо build-time URL.
- **Деплой-обвязка спроектирована хорошо:** reusable workflow, стадии resolve-tag → validate → backup → migrate → seed → deploy → verify → rollback, pinned infra-образы по digest, hardening контейнеров (read_only, no-new-privileges, cap_drop), TLS/nginx, runbook'и (`DEPLOYMENT.md`, `ROLLBACK_STRATEGY.md`, `PRODUCTION_CHECKLIST.md`).
- **Документация:** есть канон, индексы, разделение source-of-truth.

---

## 3. P0 — блокеры выхода в прод

### 3.1 Пайплайн деплоя никогда не запускался (главный блокер)

Факты: 0 environments, 0 releases, 0 запусков `deploy.yml`/`migrate.yml`. При этом `deploy.yml` требует **непустой versioned image_tag** и GitHub Environment с 13 обязательными секретами (`deploy-environment.yml` → `pre-deploy-validate`), а `migrate.yml` жёстко зашит на `environment: production`.

Что нужно сделать (по шагам):

1. Собрать образы для текущего `main`: перезапустить `Build and Push` (workflow) и убедиться, что теги `main-e8fee2e` (backend + frontend) появились в GHCR. Сейчас для HEAD образа нет.
2. Создать GitHub Environment **`staging`**, затем **`production`** (Settings → Environments), включить required reviewers для `production`.
3. Завести секреты в каждом environment: `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PRIVATE_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SECRET_KEY` (≥32 симв.), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL` (HTTPS), `ALLOWED_ORIGINS` (HTTPS, без `*`), `VITE_API_URL` (с `/api/v1`), `VITE_TELEGRAM_BOT_USERNAME`, опционально `SENTRY_DSN`, `SLACK_WEBHOOK_URL`.
4. Подготовить сервер: Docker + Compose, каталог `~/fittracker-pro`, `NGINX_SSL_DIR` с `fullchain.pem`/`privkey.pem`, `BACKUPS_DIR` вне репозитория, firewall 22/80/443.
5. Прогнать **staging-rehearsal** (`docs/STAGING_DEPLOYMENT_REHEARSAL.md`, `scripts/staging-rehearsal.ps1`): первый полный deploy (миграции + seed + smoke) на staging, затем репетиция rollback.
6. Опубликовать первый GitHub Release (`v1.0.0`) → это триггер production-деплоя по DAG'у.

Пока шаги 1–5 не сделаны, «продакшен» — это теория: ни один из ~40 скриптов, миграций и smoke-проверок не выполнялся на реальном сервере.

### 3.2 Ежедневно красный CI убивает сигнал

- `E2E Smoke Real API` падает на **первом же шаге** — `ephemeral secrets` `E2E_BASE_URL`, `E2E_API_BASE_URL`, `E2E_TELEGRAM_INIT_DATA` не заданы. Нужно: либо завести секреты (тогда получить `init_data` от тестового пользователя и продлить его срок), либо перевести job в режим «skip при отсутствии секретов» и оставить один ручной `workflow_dispatch`.
- `Security` падает на `npm audit --audit-level=moderate` (17 уязвимостей) и `pip-audit` (`ecdsa 0.19.2`, PYSEC-2026-1325 через `python-jose`).
  - В прод-бандл реально попадают: `react-router`/`react-router-dom` (open redirect / constructor injection, фикс — 7.18.4, **breaking**), `valibot` через `@telegram-apps/*` (ReDoS), `@redocly/openapi-core → js-yaml` (dev).
  - Практический риск `ecdsa` низкий (приложение подписывает HS256, ECDSA не используется), но CI красный → нужно обновить `python-jose` или заменить его на `PyJWT` и закрыть аудит.
  - Рекомендация: не гасить проверку, а добавить allowlist с обязательным сроком истечения + Dependabot-группы, чтобы «обновить транзитивную зависимость» не блокировало релиз на недели.

### 3.3 Открытый Telegram-вебхук и выключенный бот в проде

- `docker-compose.prod.yml` жёстко фиксирует `TELEGRAM_BOT_ENABLED=false` → в проде бот **не стартует вообще**: нет `/start`, нет `/stats`, не выставляется Menu Button Mini App. Для Telegram Mini App это потеря единственного «встроенного» канала возврата пользователя.
- `POST /telegram/webhook` в `app/main.py` **не проверяет** `X-Telegram-Bot-Api-Secret-Token`, и в `start_bot_webhook()` не передаётся `secret_token` при `set_webhook`. Nginx специально отключает для этого пути rate-limit. Итог: любой, кто знает домен, может слать поддельные updates. Нужно: добавить `TELEGRAM_WEBHOOK_SECRET` в настройки, передавать его в `set_webhook(secret_token=...)`, сверять заголовок на входе (constant-time), и только потом — включать `TELEGRAM_BOT_ENABLED=true`.

### 3.4 Медицинские данные: нет базового compliance-слоя

В приложении есть глюкоза, вес, сон, самочувствие (потенциально — «специальные категории» персональных данных). В репозитории отсутствуют: политика конфиденциальности, текст согласия на обработку данных о здоровье, описания retention, e-mail/канал для запросов субъекта данных. `DELETE /users/me` и `GET /users/export` реализованы (это плюс), но без документов и без явного согласия публикация такого продукта — юридический риск. Минимум до публичного запуска: страница политики в приложении/боте + явный чек-бокс согласия при онбординге + раздел о хранении и удалении.

### 3.5 Emergency-функция сейчас врёт пользователю

`frontend/src/features/home/components/EmergencyButton.tsx`: обработчик подтверждения содержит комментарий-заглушку и показывает тост **«Вызов экстренной помощи отправлен»**, ничего при этом не отправляя. Бэкенд эмердженси-функций (`/api/v1/system/emergency/*`) при этом полностью готов, а компонент `EmergencyMode.tsx` (с реальными мутациями) **не подключён ни к одному маршруту**, как и сама кнопка — она не рендерится на главной. Для фичи «мне плохо» такое поведение недопустимо: либо реализовать честный флоу (созвоны/уведомление контактов + лог события), либо убрать UI из бандла до реализации.

---

## 4. P1 — продуктовые дыры (то, что пользователь увидит как «недоделку»)

### 4.1 Экран «Здоровье» работает на мок-данных

`frontend/src/features/health/pages/HealthPage.tsx` (маршрут `/health`) целиком построен на объекте `mockData` (вес 75.5, шаги 8432, пульс 72…) и плейсхолдере графика. При этом рядом лежат **готовые** компоненты `GlucoseTracker.tsx`, `WaterTracker.tsx`, `WellnessCheckin.tsx` с реальными query/mutation к `/health-metrics/*` — и они не подключены ни к одному маршруту. Бэкенд-API для воды/глюкозы/wellness/замеров тела существует и покрыт тестами (`test_water.py` — 100%).

Что сделать: переписать `/health` на реальные данные (замеры тела + вода + глюкоза + wellness), удалить `mockData` и плейсхолдер-график, подключить трекеры (модально или отдельными блоками).

### 4.2 Виджеты главной не отрендерены

`GlucoseWidget`, `WaterWidget`, `WellnessWidget`, `EmergencyButton` экспортируются из `features/home/components/index.ts`, но `Home.tsx` их не импортирует — «дашборд здоровья» на главной отсутствует. Есть также `mapHealthToDashboard.ts` и `useHomeWaterQuery.ts` без потребителей. Нужно либо смонтировать их на главной, либо удалить мёртвый код (сейчас он увеличивает поддержку и путает новых разработчиков).

### 4.3 Неполные/заглушечные бэкенд-пути

- `GET /users/stats`: `active_days` и `total_calories` **всегда 0** (хардкод), остальное считается корректно.
- `coach-access` (выдача доступа тренеру) хранится в `user.profile` JSON, реального механизма доступа тренера к данным нет — это заглушка, видимая в UI профиля.
- `analytics/calendar` строится на грубом маппинге тегов (зафиксировано в roadmap как known limitation).

### 4.4 TODO в критичном флоу активной тренировки

`ActiveWorkoutContainer.tsx` («TODO: integrate with existing add exercise flow»), `useActiveWorkout.ts` («TODO: добавить debounce»), `ExerciseCard.tsx` («TODO: получить totalSets из шаблона»), `useWorkoutSession.ts` (2 TODO по интеграции со store). Это ядро продукта — стоит закрыть до выката.

### 4.5 Тестовое покрытие фронта

20.8% lines при заявленной стратегии unit 60–70%. Критичные пути покрыты (offline sync, активная тренировка, auth), но общий уровень низкий и защищён только «baseline без регрессий». Плюс `useWorkoutSessionDraftCloudSync.test.ts` — файл из одних TODO-комментариев (пустой тест).

### 4.6 Дрейф документации и мёртвые зависимости

- README обещает удаление legacy-алиасов `/api/v1/auth|achievements|challenges|emergency` в `v1.2.0` к **2026-06-30** — дата прошла, алиасы на месте, версия проекта по-прежнему `1.0.0` и релизов нет.
- `frontend/e2e/README.md` ссылается на **GitLab CI** (`e2e_mvp_golden_path` job) — в проекте GitHub Actions.
- Снимки в `docs/reports/` датированы мартом–маем 2026 и частично устарели (например, `FRONTEND_BACKEND_API_AUDIT.md` утверждает, что water API отсутствует — оно реализовано и покрыто тестами).
- `@tonconnect/ui-react` в зависимостях фронта не используется ни в одном файле `src/` (0 ссылок) — лишний вес и поверхность supply-chain.
- Открыт висящий PR #148 «Codex/production readiness p0» от 2026-09-04 в состоянии `CONFLICTING` — его нужно либо добить/rebase, либо закрыть, иначе он маскирует часть работ (analytics, auth, coverage).

---

## 5. P1 — эксплуатация (надёжность и наблюдаемость)

1. **Нет регулярных бэкапов.** Автоматика есть только перед миграцией (`scripts/backup_before_migrate.sh` через deploy-пайплайн). Нужен cron/systemd-timer на хосте (`pg_dump` + ротация + выгрузка за пределы сервера) и **проверенный** restore-drill, а не только инструкция.
2. **Мониторинг не входит в деплой.** `monitoring/docker-compose.monitoring.yml` поднимается вручную, образы `prom/prometheus:latest`, `grafana:latest` (расходится с политикой «pinned by digest» для прод-стека), `alertmanager` требует `TELEGRAM_CHAT_ID` и падает без него. Нужно: пинning по digest, запуск вместе с прод-стеком (или отдельным compose с документированным runbook), алерты в Telegram, дашборд по ключевым метрикам (RPS, p95, 5xx, `readiness != ready`, пул БД).
3. **Sentry.** Код готов, но без подтверждённого `SENTRY_DSN` + алертов в проде ошибки невидимы. Нужно завести DSN и проверить тестовое событие.
4. **Пул соединений БД.** `create_async_engine(settings.DATABASE_URL, echo=False)` — без `pool_size`/`max_overflow`/`pool_pre_ping`/`pool_recycle`. Для gunicorn + N воркеров это даёт неявные лимиты и «залипшие» соединения после рестарта Postgres. Стоит сделать параметры настраиваемыми через env.
5. **Ротация и отзыв токенов.** Refresh-токен stateless (7 дней), `logout` — no-op на сервере, серверного blacklist/ротации нет: украденный refresh живёт до истечения срока и после «выхода». Для медицинских данных стоит добавить таблицу refresh-сессий (или `token_version` в `users`) и инвалидацию при logout/удалении аккаунта.
6. **Отсутствует нагрузочный прогон.** E2E-наборы есть, но нет ни одного k6/locust-сценария на активную тренировку («много мелких мутаций подряд») — именно этот профиль нагрузки даст узкое место. Плюс стоит включить `pg_stat_statements`/логи медленных запросов на staging.
7. **Нет алертов на бизнес-метрики** (ошибки синхронизации offline-очереди, доля 4xx на auth, время ответа analytics) — их уже эмитит `workoutSyncTelemetry`, но дашбордов/алертов нет.

---

## 6. P2 — после запуска

- Удаление legacy-алиасов `/api/v1/{auth,achievements,challenges,emergency}` и синхронизация README с фактической версией/датами.
- Поднять покрытие фронта до заявленных 60–70% (начать с `features/health`, `features/analytics`, `features/profile` — сейчас почти не покрыты).
- Оптимизация бандла: `charts` 375 KB (109 KB gzip) и `index` 377 KB (122 KB gzip) — кандидаты на дальнейшее дробление/дефер.
- Кэширование аналитики (Redis-кэш уже есть в `infrastructure/cache.py`) и материализация тяжёлых агрегатов (`training_load_daily`, `muscle_load`).
- Централизованные логи (Loki/Promtail уже в `monitoring/`) + аудит-лог доступа к медицинским данным.
- `docs/` — консолидация устаревших снимков, чтобы не расходились с реальностью.

---

## 7. План «до прода» (предлагаемая последовательность, ~2 недели)

**День 1–2: зелёный CI и образы**
1. Закрыть `Security`: обновить `react-router-dom` до 7.18.4 (и разобрать breaking-изменения в роутерах), обновить/заменить `python-jose`, обновить `valibot`/`@telegram-apps/*`, обновить `vite`/`esbuild`/eslint-цепочку (dev, но CI красный).
2. Починить или пере-скоупить `E2E Smoke Real API` (секреты либо graceful-skip).
3. Перезапустить `Build and Push` для `main`, зафиксировать тег образа.

**День 3–5: staging**
4. Создать Environment `staging`, завести секреты, подготовить сервер и TLS.
5. Выполнить deploy на staging по `docs/STAGING_DEPLOYMENT_REHEARSAL.md`: миграции + seed + smoke (`/system/health`, `/system/ready`, `/system/version`, `/healthz`, `/health`).
6. Прогнать `rollback-production.yml` на staging (сценарий A) и один restore БД из pre-migrate бэкапа на тестовой базе.

**День 6–9: продукт**
7. `/health` → реальные данные; подключить `GlucoseTracker`/`WaterTracker`/`WellnessCheckin`; убрать `mockData`.
8. Emergency: реализовать честный флоу (уведомление контактов/лог события через `/system/emergency/*`) либо удалить UI.
9. Закрыть TODO в активной тренировке; убрать хардкод `active_days`/`total_calories`.
10. Виджеты здоровья на главной либо монтировать, либо удалить.

**День 10–12: эксплуатация**
11. Регулярные бэкапы + ротация + restore-drill.
12. Sentry DSN + алерты; мониторинг с pinned-образами и алертами в Telegram; дашборды.
13. Пул БД с настройками через env; refresh-сессии с инвалидацией.
14. Политика конфиденциальности + согласие на обработку данных о здоровье в онбординге.

**День 13–14: первый prod-релиз**
15. Release `v1.0.0` → production deploy с required reviewers; проверить Mini App в Telegram вживую (вход, тренировка от старта до завершения, аналитика, offline-режим), включить бота (webhook с secret token) и проверить `/start`, `/stats`, Menu Button.
16. Зафиксировать стабильный тег и провести пост-релизный разбор.

---

## 8. Приложение: где что лежит

| Тема | Файлы |
|---|---|
| Мок-экран здоровья | `frontend/src/features/health/pages/HealthPage.tsx` (строки 17, 56, 100) |
| Неиспользуемые трекеры | `frontend/src/features/health/components/{Glucose,Water}Tracker.tsx`, `WellnessCheckin.tsx` |
| Неиспользуемые виджеты | `frontend/src/features/home/components/{Glucose,Water,Wellness}Widget.tsx`, `.../index.ts` |
| Заглушка emergency | `frontend/src/features/home/components/EmergencyButton.tsx:20-26`; не подключённый `EmergencyMode.tsx` |
| Кнопка бота в проде | `docker-compose.prod.yml:98` (`TELEGRAM_BOT_ENABLED=false`) |
| Вебхук без секрета | `backend/app/main.py:296`; `backend/app/bot/main.py:356` (`set_webhook`) |
| Пул БД | `backend/app/infrastructure/database.py:12` |
| Stateless refresh | `backend/app/core/security/tokens.py`, `backend/app/application/auth_service.py:211-238` |
| Хардкод статистики | `backend/app/api/v1/users.py:83-105` |
| Бэкапы только pre-migrate | `scripts/backup_before_migrate.sh`, `.github/workflows/deploy-environment.yml` |
| Мониторинг отдельно, `:latest` | `monitoring/docker-compose.monitoring.yml` |
| Обязательные секреты деплоя | `.github/workflows/deploy-environment.yml` (job `pre-deploy-validate`) |
| Runbook'и | `docs/DEPLOYMENT.md`, `docs/ROLLBACK_STRATEGY.md`, `docs/PRODUCTION_CHECKLIST.md`, `docs/STAGING_DEPLOYMENT_REHEARSAL.md` |
