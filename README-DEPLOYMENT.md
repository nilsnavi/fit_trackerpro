# FitTracker Pro — Deployment Reference

Короткий operational runbook: что считать источником правды, как устроен production-деплой и откат.

## Source of truth

| Что | Где в репозитории |
|-----|-------------------|
| Сборка и публикация образов в GHCR | `.github/workflows/build.yml` |
| Деплой на сервер, смоук, авто-rollback, уведомления | `.github/workflows/deploy.yml` |
| Имена образов и runtime-сеть | `docker-compose.prod.yml` |
| Развёртывание с нуля (bootstrap, секреты, nginx/ssl) | `docs/DEPLOYMENT.md` |
| Детали отката и политика БД | `docs/ROLLBACK_STRATEGY.md` |

**Образы в registry** (как в `docker-compose.prod.yml`):

- `ghcr.io/<GITHUB_REPOSITORY>/backend:<tag>`
- `ghcr.io/<GITHUB_REPOSITORY>/frontend:<tag>`

`<GITHUB_REPOSITORY>` — `owner/repo` текущего GitHub-репозитория; в `.env` на сервере его выставляет workflow (`GITHUB_REPOSITORY=${{ github.repository }}`).

**Каталог на сервере** (зашито в `deploy.yml`): `~/fittracker-pro` (создаётся при первом деплое). Все команды ниже предполагают `cd ~/fittracker-pro`.

Production — **image-based**: на сервере не делают `git pull`, `git checkout` и `docker build` приложения; только `pull` готовых образов из GHCR.

## Когда появляются теги образов (`build.yml`)

- **Push в `main`** — пушатся теги вроде `main`, `main-<sha>`, `latest` (см. `docker/metadata-action` в workflow).
- **Публикация GitHub Release** — дополнительно семвер-теги (`v1.2.3` и т.д.) и `latest`.

`deploy.yml` и `build.yml` оба реагируют на `release: published`. Имеет смысл **убедиться, что job «Build and Push» успешно завершился** для нужного tag (при сбое — повторить деплой через **Run workflow** с тем же `image_tag` после зелёной сборки).

## Автоматический деплой (`deploy.yml`)

### Триггеры

1. **GitHub Release → Published** — в `.env` на сервере выставляется `IMAGE_TAG=<имя тега релиза>` (например `v1.0.0`).
2. **Actions → Deploy to Production → Run workflow** — поле **Image tag** (`image_tag`, по умолчанию `latest`).

Поле **Environment** в форме `workflow_dispatch` (production / staging) **в текущем YAML не используется** — фактическая цель всегда `secrets.DEPLOY_HOST` и `~/fittracker-pro`.

### Цепочка jobs

1. **Deploy** — SSH на сервер, синхронизация `docker-compose.prod.yml` и `nginx/nginx.conf`, перезапись корневого `.env` из GitHub Secrets, запись `.rollback-meta.env` (в т.ч. `PREVIOUS_IMAGE_TAG`, путь бэкапа БД), `pg_dump` в `backups/`, `docker-compose pull`, `run --rm backend alembic upgrade head`, `up -d`, `docker image prune -f`, проверки с хоста: `http://localhost:8000/api/v1/system/health`, `/api/v1/system/version`, `http://localhost/`.
2. **Post-deploy Smoke** — с раннера GitHub, по `secrets.VITE_API_URL`: корень API, `/system/health`, проба доменного эндпоинта (допускаются `401/403` если включена авторизация).
3. **Rollback on Failure** — выполняется, если упал **deploy** или **smoke**: откат `IMAGE_TAG` на `PREVIOUS_IMAGE_TAG`, `pull backend frontend`, `up -d`, опционально восстановление БД из бэкапа только если при ручном запуске был включён **`rollback_restore_db`**.
4. **Notify** — Slack (успех / ошибка), если задан `SLACK_WEBHOOK_URL`.

При падении миграций удалённый скрипт завершится с ошибкой → сработает rollback-job (при успешном SSH).

### GitHub Secrets (используются в `deploy.yml`)

**Обязательные для деплоя:**

- `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PRIVATE_KEY`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`, `ALLOWED_ORIGINS`
- `VITE_API_URL`, `VITE_TELEGRAM_BOT_USERNAME`

**Опциональные:**

- `SENTRY_DSN` (можно пустым)
- `SLACK_WEBHOOK_URL`

## Ручной эквивалент шагов на сервере

Имеет смысл только если Actions недоступен; порядок совпадает с удалённой частью **Deploy** (после того как `.env` и файлы compose/nginx уже на месте):

```bash
cd ~/fittracker-pro
mkdir -p backups nginx/ssl nginx/logs
# .env должен содержать POSTGRES_*, SECRET_KEY, TELEGRAM_*, ALLOWED_ORIGINS, SENTRY_DSN (если нужен),
# VITE_*, IMAGE_TAG, GITHUB_REPOSITORY — как в деплой-воркфлоу

docker exec fittracker-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "backups/backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker-compose -f docker-compose.prod.yml up -d
curl -fsS http://localhost:8000/api/v1/system/health
curl -fsS http://localhost:8000/api/v1/system/version
curl -fsS http://localhost/
```

Скрипт **`deploy.sh`** в корне репозитория не синхронизирован с текущим пайплайном (другие пути, устаревший bootstrap `.env`). Для процедур опирайтесь на этот файл и на `docs/DEPLOYMENT.md`.

## Rollback

Автоматика описана выше и подробнее в `docs/ROLLBACK_STRATEGY.md`. Ручной минимум на сервере:

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s/^IMAGE_TAG=.*/IMAGE_TAG=${PREVIOUS_IMAGE_TAG}/" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

Восстановление БД из `DB_BACKUP_PATH` — только осознанно; см. `docs/ROLLBACK_STRATEGY.md`.

## Health endpoints

- Платформа / деплой / uptime: `/api/v1/system/health`, `/api/v1/system/version`
- Бизнес-метрики пользователя: `/api/v1/health-metrics/*`

## Окружения

### Development (`docker-compose.yml`)

- Postgres/Redis с пробросом портов для разработки.
- Нужен `SECRET_KEY` (и прочие переменные по README проекта).

### Production (`docker-compose.prod.yml`)

- Postgres/Redis без публикации наружу (внутренняя сеть).
- Backend валидирует env при старте: длина `SECRET_KEY`, `ALLOWED_ORIGINS` без wildcard, `DEBUG=false`.
- `DATABASE_URL` / `DATABASE_URL_SYNC` / `REDIS_URL` для контейнеров **задаются в compose**, в корневой `.env` на сервере их указывать не требуется — достаточно `POSTGRES_*` и секретов из таблицы выше.

## Переменные в корневом `.env` на сервере

Файл при автодеплое **перезаписывается** из Secrets. Состав соответствует heredoc в `deploy.yml`:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`, `ALLOWED_ORIGINS`, `SENTRY_DSN`
- `VITE_API_URL`, `VITE_TELEGRAM_BOT_USERNAME`
- `IMAGE_TAG` (релизный tag или значение из ручного запуска)
- `GITHUB_REPOSITORY` (owner/repo для пути образа в GHCR)
