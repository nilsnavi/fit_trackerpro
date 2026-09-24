# Staging Readiness Report

Дата: 2026-05-08

Репозиторий: `nilsnavi/fit_trackerpro`

Локальный commit на момент проверки: `dd0cd42d3ad3859501e5868c86dc7d3e65d039f1` (`main-dd0cd42`)

## Итог

Staging deployment rehearsal не был запущен из текущего окружения, потому что:
- `gh` CLI не установлен в текущем окружении, а Chocolatey install failed из-за отсутствия elevated shell и lock в `C:\ProgramData\chocolatey\lib`;
- переменные `GITHUB_TOKEN`/`GH_TOKEN` в окружении отсутствуют;
- GitHub API без authentication не дает проверить secrets (`401 Requires authentication`);
- доступа к staging серверу и значениям secrets нет.

Успешный деплой не имитировался.

Подготовлен операторский runbook: `docs/STAGING_DEPLOYMENT_REHEARSAL.md`.

Добавлен fallback runner без зависимости от `gh`: `scripts/staging-rehearsal.ps1`.

## Что проверено локально

- Workflow `.github/workflows/deploy.yml` существует, активен по GitHub API и поддерживает `workflow_dispatch`.
- Workflow принимает inputs:
  - `environment`: `production` или `staging`;
  - `image_tag`: обязательный versioned tag, `latest` запрещен;
  - `rollback_restore_db`: optional boolean.
- Reusable workflow `.github/workflows/deploy-environment.yml` привязан к GitHub Environment через `environment: ${{ inputs.deploy_environment }}`.
- Последние локальные tags: `pre-sanitize-2026-04-13`, `v2026.04.05-workouts-modal-standardization`.
- `git describe --tags --abbrev=0` для текущего HEAD не находит описывающий tag, поэтому рекомендуемый rehearsal tag для текущего состояния нужно вычислить как `main-$(git rev-parse --short HEAD)`, при условии что GHCR images с таким tag уже опубликованы.

## Исправления перед rehearsal

В `.github/workflows/deploy-environment.yml` исправлены smoke/deploy checks:

- `GET /api/v1/system/version` теперь проверяется по корректному URL `${VITE_API_URL}/system/version`, а не `${VITE_API_URL}/version`.
- On-host backend readiness/version checks выполняются внутри контейнера backend через `docker-compose exec -T backend`, потому что production compose не публикует порт backend на host `localhost:8000`.
- Добавлена frontend health проверка `/healthz`.
- Reverse proxy health проверяется через `https://localhost/health` с `-k`, что соответствует TLS-only nginx конфигурации.
- Rollback verification использует те же корректные backend-in-container и nginx `/health`/`/healthz` проверки.
- Manual rollback workflow `.github/workflows/rollback-production.yml` теперь поддерживает выбор `environment=staging` и требует `confirm=ROLLBACK`.
- Добавлен `scripts/staging-rehearsal.ps1`: проверяет GitHub Environment, наличие обязательных Environment secrets, active state workflow `deploy.yml`, умеет выполнить `workflow_dispatch`, дождаться результата, запустить smoke checks и проверить backup metadata на сервере.

## Environment `staging`

Статус: не подтвержден.

Неаутентифицированный запрос:

```text
GET /repos/nilsnavi/fit_trackerpro/environments/staging -> 404 Not Found
```

Этот результат не доказывает отсутствие Environment, потому что endpoint требует подходящих прав для private/settings data.

Команда для оператора:

```powershell
$env:GITHUB_TOKEN = "<token-with-repo-actions-environment-access>"
powershell -ExecutionPolicy Bypass -File scripts/staging-rehearsal.ps1
```

Альтернатива через `gh`:

```bash
gh api repos/nilsnavi/fit_trackerpro/environments/staging
```

Если Environment отсутствует, создать `staging` по инструкции в `docs/STAGING_DEPLOYMENT_REHEARSAL.md`.

## Secrets

Статус: не подтвержден.

Неаутентифицированный запрос:

```text
GET /repos/nilsnavi/fit_trackerpro/actions/secrets -> 401 Requires authentication
```

Обязательные staging secrets:

```text
DEPLOY_HOST
DEPLOY_USER
SSH_PRIVATE_KEY
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
SECRET_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBAPP_URL
ALLOWED_ORIGINS
VITE_API_URL
VITE_TELEGRAM_BOT_USERNAME
```

Оператор должен проверить наличие имен:

```powershell
$env:GITHUB_TOKEN = "<token-with-repo-actions-environment-access>"
powershell -ExecutionPolicy Bypass -File scripts/staging-rehearsal.ps1
```

Альтернатива через `gh`:

```bash
gh secret list --env staging --repo nilsnavi/fit_trackerpro
```

## Deploy status

Статус: не запускался из текущего окружения.

Команда запуска для оператора:

```powershell
$env:GITHUB_TOKEN = "<token-with-repo-actions-environment-access>"
powershell -ExecutionPolicy Bypass -File scripts/staging-rehearsal.ps1 `
  -ImageTag "main-$(git rev-parse --short HEAD)" `
  -Dispatch `
  -Wait
```

Альтернатива через `gh`:

```bash
IMAGE_TAG="main-$(git rev-parse --short HEAD)"

gh workflow run deploy.yml \
  --repo nilsnavi/fit_trackerpro \
  --ref main \
  -f environment=staging \
  -f image_tag="${IMAGE_TAG}" \
  -f rollback_restore_db=false
```

## Миграции и seed

Статус: не выполнялись.

Ожидаемые признаки успеха в workflow:
- stage `migrate` successful;
- `Backup database before migration` successful;
- `alembic upgrade head` successful;
- `python3 -m app.cli.seed_reference_data apply` successful;
- `.rollback-meta.env` содержит `DB_BACKUP_PATH`.

## Health/readiness/smoke

Статус: не выполнялись против staging.

Ожидаемые проверки после deploy:

```bash
curl -fsS "${API_BASE_URL}/system/health" | jq -e '.status == "healthy"'
curl -fsS "${API_BASE_URL}/system/ready" | jq -e '.status == "ready" and .checks.postgres == "ok" and .checks.redis == "ok"'
curl -fsS "${API_BASE_URL}/system/version" | jq -e '.version != null'
curl -fsS "${FRONTEND_BASE_URL}/healthz"
```

## Telegram golden path

Статус: не выполнялся.

Должен быть подтвержден вручную оператором:
- Telegram login successful;
- workout create/start/finish successful;
- analytics page opens and reflects workout data;
- no blocking console/network errors.

## Backup и rollback

Статус: не выполнялись на сервере.

Команды проверки:

```bash
ssh "${DEPLOY_USER}@${DEPLOY_HOST}"
cd ~/fittracker-pro
test -f backups/.last_pre_migrate_backup_path
DB_BACKUP_PATH="$(tr -d '\r\n' < backups/.last_pre_migrate_backup_path)"
test -f "$DB_BACKUP_PATH"
grep -E '^DB_BACKUP_PATH=' .rollback-meta.env
```

Rollback rehearsal: использовать сценарий A из `docs/ROLLBACK_STRATEGY.md` для staging, если нет явного разрешения на DB restore.

Команда manual rollback workflow для staging:

```bash
gh workflow run rollback-production.yml \
  --repo nilsnavi/fit_trackerpro \
  --ref main \
  -f environment=staging \
  -f rollback_image_tag='<previous-known-good-tag>' \
  -f rollback_restore_db=false \
  -f confirm=ROLLBACK
```

## Решение go/no-go

Текущий статус: no-go для заявления о готовности staging, потому что деплой и серверные проверки не выполнены.

Условный go после выполнения оператором:
- Environment и secrets подтверждены;
- workflow `deploy.yml` на `staging` успешен;
- smoke checks успешны;
- Telegram golden path подтвержден;
- backup и rollback metadata подтверждены;
- rollback path проверен и зафиксирован.
