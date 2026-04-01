# Production readiness review — FitTracker Pro (Telegram Mini App)

**Дата:** 2026-04-01  
**Область:** backend (FastAPI), `docker-compose.prod.yml`, `nginx/nginx.conf`, GitHub Actions (`deploy-environment.yml`, `deploy.yml`), observability (Sentry, Prometheus в `monitoring/`).

**После ревью внесены правки:** обязательные `TELEGRAM_WEBAPP_URL` и `ALLOWED_ORIGINS` в `docker-compose.prod.yml`; валидация непустого `ALLOWED_ORIGINS` в production в `config.py`; порядок миграций в `deploy.sh` приведён к CI (`pull` → `alembic` → seed → `up -d`); тесты в `test_config_validation.py`.

---

## Executive summary

Стек в целом **сознательно приближен к production**: жёсткая валидация секретов в `ENVIRONMENT=production`, отключение OpenAPI в prod, пинning образов по digest, многоступенчатый deploy с миграциями, бэкапом БД и smoke-проверками. Основные **блокеры** перед «настоящим» продом — устранить расхождения ручного `deploy.sh` с CI, гарантировать обязательность критичных переменных в compose и закрыть сценарии отката при изменении схемы БД. **Health** сейчас — liveness «процесс жив», без проверки PostgreSQL/Redis.

Приоритеты:

| Приоритет | Смысл |
|-----------|--------|
| **P0** | Блокирует безопасный или предсказуемый production |
| **P1** | Высокий риск инцидента или долгого MTTR; исправить до/сразу после первого prod |
| **P2** | Улучшения надёжности, наблюдаемости, DX |

---

## 1. Сильные стороны текущего deploy setup

1. **Валидация окружения (backend)** — `backend/app/settings/config.py`: при `ENVIRONMENT=production` отклоняются SQLite/dev URL, dev `SECRET_KEY`, dev токен Telegram, localhost `TELEGRAM_WEBAPP_URL`; `DEBUG=true` и `ALLOWED_ORIGINS=*` запрещены.
2. **CORS** — в production wildcard CORS отклоняется валидатором; список origins парсится из строки с запятыми.
3. **DEBUG в production** — в `docker-compose.prod.yml` зафиксировано `DEBUG=false`; OpenAPI (`/docs`, `/redoc`) отключаются при `DEBUG=false` в `main.py`.
4. **docker-compose.prod.yml** — образы БД/Redis/Nginx с **digest**; лимиты CPU/RAM; PostgreSQL и Redis в **internal** сети `backend-internal`; healthcheck’и у postgres/redis/backend.
5. **nginx** — редирект HTTP→HTTPS; TLS 1.2/1.3; HSTS; раздельные `location` для API, webhook, фронта; **CSP `frame-ancestors`** под Telegram; rate limit на `/api/`; заголовки безопасности; алиас **`/health`** → тот же JSON, что и backend.
6. **Health / version** — `GET /health`, `GET /api/v1/system/health`, `GET /api/v1/system/version`; версия и build metadata из `APP_VERSION`, `GIT_COMMIT_SHA`, `BUILD_TIMESTAMP` (прокидываются в Docker build).
7. **Миграции в deploy flow** — job `migrate`: `pg_dump` → `docker compose pull` → `alembic upgrade head` → idempotent seed → затем `deploy` с `up -d`.
8. **Rollback / smoke** — при падении migrate/deploy/verify запускается job `rollback` с откатом `IMAGE_TAG`; опционально восстановление БД из бэкапа; внешние smoke через `VITE_API_URL` (health, version, nginx `/health`, корень фронта).
9. **Sentry** — инициализация с redaction `Authorization`/`Cookie`; фильтрация транзакций для health/metrics; sample rates по окружению.
10. **Секреты** — pre-deploy проверка непустых GitHub secrets; `docker compose ... config` и `nginx -t` до SSH.
11. **Backend runtime** — Gunicorn + Uvicorn workers, non-root user в образе; structured logging и middleware (correlation ID, rate limit).

---

## 2. Риски

| Область | Риск | Примечание |
|---------|------|------------|
| **docker-compose.prod.yml** | `ALLOWED_ORIGINS=${ALLOWED_ORIGINS}` без обязательности — пустая строка даст «пустой» allowlist и сломает Mini App без явного фейла на старте. | `TELEGRAM_WEBAPP_URL` тоже без `:?` — при ошибке в secrets приложение упадёт при старте, но поздно. |
| **Health** | `/api/v1/system/health` всегда `status: healthy` без проверки БД/Redis. | При деградации БД балансировщик/nginx могут продолжать считать сервис «зелёным». |
| **Rollback** | Откат образов без `rollback_restore_db` при уже применённой миграции | Код старой версии + схема новой версии → возможны 500/ошибки до ручного restore/downgrade миграций. |
| **Первый deploy** | Нет `PREVIOUS_IMAGE_TAG` в `.rollback-meta.env` | Job rollback завершится ошибкой при первом неуспешном деплое (ожидаемо, но нужна процедура). |
| **Ручной deploy** | `deploy.sh`: `up -d` **до** `alembic upgrade head` | Противоположно CI: окно, когда новый код смотрит на старую схему (или наоборот). |
| **Мониторинг** | `monitoring/docker-compose.monitoring.yml` не связан с основным deploy; образы `prometheus/grafana/...:latest` | Риск дрейфа версий; Prometheus не в стандартном пайплайне. |
| **Уведомления** | Slack webhook опционален | При пустом `SLACK_WEBHOOK_URL` шаг notify может падать (зависит от action). |
| **Метрики** | `/metrics` не проксируется через edge nginx | Снижает риск утечки наружу; скрейп только из сети compose — ок, если мониторинг поднят. |
| **Корневой API** | `GET /` возвращает подсказку `"docs": "/docs"` | Даже при отключённом Swagger — лёгкая информационная утечка. |

---

## 3. Quick wins (низкая стоимость / высокая отдача)

1. **Compose:** заменить на `${ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required}` и `${TELEGRAM_WEBAPP_URL:?TELEGRAM_WEBAPP_URL is required}` в `docker-compose.prod.yml`.
2. **Pydantic:** в `validate_allowed_origins` для production требовать непустой список после split (запретить `[""]`).
3. **Единый порядок миграций:** в `deploy.sh` выполнять `alembic upgrade head` **до** `up -d` (как в CI), используя `docker compose run --rm backend alembic upgrade head` после pull.
4. **Release checklist:** добавить в `docs/PRODUCTION_CHECKLIST.md` явный пункт «миграции до переключения трафика» и ссылку на CI как эталон.
5. **Smoke после деплоя:** внешние проверки уже в `verify`; добавить вручную в чеклист: открыть Mini App в Telegram, один логин и один защищённый запрос.
6. **Sentry:** задать `SENTRY_DSN` в staging/production и один раз проверить тестовое событие (уже есть в чеклисте — закрепить как обязательное для P1).

---

## 4. Blocking issues (до «реального» production)

Ниже — что считать **обязательным** до принятия production-трафика (минимальный набор).

### P0 — блокирующие

1. **Согласованность схемы БД и кода при деплое** — ручной `deploy.sh` должен повторять порядок CI: бэкап → pull → миграции → seed (если нужен) → `up -d`, иначе не гарантировать целостность при обновлениях.
2. **Обязательные prod-переменные в compose** — как минимум `ALLOWED_ORIGINS` и `TELEGRAM_WEBAPP_URL` с fail-fast при отсутствии (см. quick wins).
3. **Процедура отката при миграциях** — задокументировать: когда включать `rollback_restore_db`, когда нужен ручной `alembic downgrade`, ограничения `psql < backup` при несовместимых изменениях.
4. **Проверка Telegram webhook / HTTPS** — убедиться, что `https://<domain>/telegram/webhook` доступен Telegram и совпадает с BotFather (вне кода, но в operational checklist).

### P1 — сразу после запуска или до нагрузки

1. **Readiness / degraded health** — расширить health (или отдельный `/ready`) проверкой пула БД и при необходимости Redis; возвращать `503` при недоступности зависимостей.
2. **Sentry в production** — без DSN слепые зоны по ошибкам; минимум для prod — настроенный DSN и алерты.
3. **Мониторинг** — закрепить стек (prometheus/grafana) или хотя бы диск/память/CPU + алерты; не использовать `:latest` без пина digest в prod.
4. **Первый деплой и rollback** — явная инструкция: первый deploy без `PREVIOUS_IMAGE_TAG` → rollback только ручной.

### P2 — улучшения

1. **Pre-deploy:** опционально запускать контейнер backend с `ENVIRONMENT=production` и теми же env (dry-run) для ранней валидации Settings.
2. **Корневой `/`** — не отдавать `docs` в JSON при `DEBUG=false`.
3. **Централизованный сбор логов** (Loki/Promtail из `monitoring/`) — если требуется аудит и расследование инцидентов.
4. **E2E smoke в CI** против staging URL после деплоя.

---

## 5. Конкретные предлагаемые правки (кратко)

### Env validation

- В `config.py`: для `ENVIRONMENT=production` отклонять `ALLOWED_ORIGINS`, если после split нет ни одного непустого origin.
- В `docker-compose.prod.yml`: `${VAR:?message}` для `ALLOWED_ORIGINS`, `TELEGRAM_WEBAPP_URL` (и при желании `SECRET_KEY` уже покрыт).

### Deploy checks

- Уже есть: secrets, compose render, nginx `-t`, post-deploy curl, внешний verify с retry.
- Добавить: при наличии — **HTTPS** smoke к `VITE_API_URL` (сейчас проверки идут по URL из секрета; убедиться, что это `https://` в production).

### Safer defaults

- Не использовать `ALLOWED_ORIGINS` без значения в `.env` на сервере; документировать в `backend/.env.production.example`.
- Пиновать образы в `monitoring/docker-compose.monitoring.yml` вместо `:latest`.

### Release checklist

- Использовать существующий `docs/PRODUCTION_CHECKLIST.md`; дополнить пунктами из раздела «Blocking» этого отчёта (миграции до `up`, откат БД, первый деплой).

### Smoke tests после deploy

- Автоматизированные: уже в `deploy-environment.yml` (`verify`).
- Ручные (обязательные для оператора): Mini App в Telegram, `POST /api/v1/users/auth/telegram`, один защищённый маршрут; webhook в логах бэкенда.

---

## 6. Ссылки на ключевые файлы

| Тема | Файл |
|------|------|
| Валидация настроек | `backend/app/settings/config.py` |
| CORS / DEBUG / docs | `backend/app/main.py` |
| Sentry | `backend/app/core/telemetry/__init__.py` |
| Ошибки 500 | `backend/app/api/exception_handlers.py` |
| Prod compose | `docker-compose.prod.yml` |
| Edge nginx | `nginx/nginx.conf` |
| Deploy pipeline | `.github/workflows/deploy-environment.yml`, `deploy.yml` |
| Мониторинг (отдельно) | `monitoring/docker-compose.monitoring.yml`, `monitoring/prometheus.yml` |

---

## 7. Итоговая таблица приоритетов

| ID | Задача | Приоритет |
|----|--------|-----------|
| R-1 | Исправить порядок миграций в `deploy.sh` (как в CI) | P0 |
| R-2 | Обязательные `ALLOWED_ORIGINS` / `TELEGRAM_WEBAPP_URL` в compose + валидация непустого списка origins | P0 |
| R-3 | Документировать rollback при миграциях (образ + БД) | P0 |
| R-4 | Readiness: зависимости БД/Redis в health | P1 |
| R-5 | Sentry DSN и алерты в prod | P1 |
| R-6 | Закрепить мониторинг (digest образов, деплой/алерты) | P1 |
| R-7 | Убрать/смягчить утечку `docs` в `GET /` при prod | P2 |
| R-8 | Dry-run валидации Settings в CI | P2 |

---

*Документ отражает состояние репозитория на момент ревью; после изменений кода пересмотреть соответствующие разделы.*
