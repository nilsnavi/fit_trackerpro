# Staging Deployment Rehearsal Runbook

Дата подготовки: 2026-05-08

Цель: безопасно провести rehearsal деплоя в GitHub Environment `staging` без использования `latest` image tag, проверить smoke/golden path и подтвердить rollback path.

## 1. Предварительные условия

На рабочей машине оператора:

```bash
gh auth status
gh repo view nilsnavi/fit_trackerpro
git fetch --tags origin
```

Требуемые права GitHub:
- read access к repository environments;
- write access к Actions workflow dispatch;
- доступ к настройке Environment secrets.

Требуемый серверный доступ:
- SSH на `DEPLOY_USER@DEPLOY_HOST`;
- Docker/Docker Compose на сервере;
- доступ к каталогу деплоя `~/fittracker-pro`.

## 2. Проверить Environment `staging`

```bash
gh api repos/nilsnavi/fit_trackerpro/environments/staging
```

Если Environment отсутствует:

1. Открыть `https://github.com/nilsnavi/fit_trackerpro/settings/environments`.
2. Нажать `New environment`.
3. Название: `staging`.
4. Protection rules:
   - `Required reviewers`: включить, если staging должен подтверждаться перед деплоем.
   - Рекомендуемые reviewers: минимум 1 владелец backend/ops или maintainer репозитория.
   - `Prevent self-review`: включить, если доступно для текущего плана GitHub.
   - Deployment branches/tags: ограничить `main` и release/version tags, если staging не должен принимать произвольные ветки.
5. Сохранить Environment.

## 3. Проверить staging secrets

Значения GitHub secrets через API не раскрываются; проверяется только наличие имен.

```bash
gh secret list --env staging --repo nilsnavi/fit_trackerpro
```

Обязательные secrets:

| Secret | Назначение |
|---|---|
| `DEPLOY_HOST` | SSH host staging сервера. |
| `DEPLOY_USER` | SSH user для деплоя. |
| `SSH_PRIVATE_KEY` | Private key для подключения GitHub Actions к staging серверу. |
| `POSTGRES_USER` | Пользователь PostgreSQL в prod compose. |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL. |
| `POSTGRES_DB` | Имя базы PostgreSQL. |
| `SECRET_KEY` | Backend signing/crypto secret, минимум 32 символа. |
| `TELEGRAM_BOT_TOKEN` | Token Telegram bot от BotFather. |
| `TELEGRAM_WEBAPP_URL` | HTTPS URL frontend Mini App. |
| `ALLOWED_ORIGINS` | Список HTTPS origins для CORS, без wildcard. |
| `VITE_API_URL` | Публичный API base URL, должен оканчиваться на `/api/v1`. |
| `VITE_TELEGRAM_BOT_USERNAME` | Username Telegram bot без токена. |

Проверка отсутствующих имен:

```bash
required='DEPLOY_HOST DEPLOY_USER SSH_PRIVATE_KEY POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SECRET_KEY TELEGRAM_BOT_TOKEN TELEGRAM_WEBAPP_URL ALLOWED_ORIGINS VITE_API_URL VITE_TELEGRAM_BOT_USERNAME'
present="$(gh secret list --env staging --repo nilsnavi/fit_trackerpro --json name --jq '.[].name')"
for name in $required; do
  echo "$present" | grep -qx "$name" || echo "missing: $name"
done
```

## 4. Сформировать versioned `image_tag`

Нельзя использовать `latest`.

Рекомендуемый tag для текущего HEAD на момент подготовки:

```bash
git rev-parse --short HEAD
# 2cce3f5

IMAGE_TAG="main-2cce3f5"
```

Если нужно использовать последний release/tag:

```bash
git describe --tags --abbrev=0
# v2026.04.05-workouts-modal-standardization
```

Перед dispatch убедиться, что GHCR images с выбранным tag существуют:

```bash
docker manifest inspect ghcr.io/nilsnavi/fit_trackerpro/backend:${IMAGE_TAG} >/dev/null
docker manifest inspect ghcr.io/nilsnavi/fit_trackerpro/frontend:${IMAGE_TAG} >/dev/null
```

Если образов с `main-2cce3f5` нет, сначала запустить build/publish pipeline или выбрать существующий release tag.

## 5. Запустить staging workflow

```bash
gh workflow run deploy.yml \
  --repo nilsnavi/fit_trackerpro \
  --ref main \
  -f environment=staging \
  -f image_tag="${IMAGE_TAG}" \
  -f rollback_restore_db=false
```

Отслеживание:

```bash
gh run list --repo nilsnavi/fit_trackerpro --workflow deploy.yml --limit 5
gh run watch --repo nilsnavi/fit_trackerpro <RUN_ID> --exit-status
gh run view --repo nilsnavi/fit_trackerpro <RUN_ID> --log
```

## 6. Post-deploy smoke checks

```bash
API_BASE_URL="https://<staging-domain>/api/v1"
FRONTEND_BASE_URL="${API_BASE_URL%/api/v1}"

curl -fsS "${API_BASE_URL}/system/health" | jq -e '.status == "healthy"'
curl -fsS "${API_BASE_URL}/system/ready" | jq -e '.status == "ready" and .checks.postgres == "ok" and .checks.redis == "ok"'
curl -fsS "${API_BASE_URL}/system/version" | jq -e '.version != null'
curl -fsS "${FRONTEND_BASE_URL}/healthz"
```

Если frontend использует `/health` вместо `/healthz`, проверить:

```bash
curl -fsS "${FRONTEND_BASE_URL}/health"
```

## 7. Telegram golden path

В Telegram открыть staging Mini App через staging bot:

1. Выполнить Telegram login.
2. Создать тренировку или выбрать существующий шаблон.
3. Запустить тренировку.
4. Добавить минимум один подход.
5. Завершить тренировку.
6. Открыть страницу аналитики.
7. Подтвердить, что новая тренировка отражается в аналитике без ошибок UI/API.

Фиксировать:
- user/account id тестового пользователя;
- время проверки;
- browser/device;
- ошибки console/network, если есть.

## 8. Проверить backup и rollback metadata

На staging сервере:

```bash
ssh "${DEPLOY_USER}@${DEPLOY_HOST}"
cd ~/fittracker-pro

test -f backups/.last_pre_migrate_backup_path
DB_BACKUP_PATH="$(tr -d '\r\n' < backups/.last_pre_migrate_backup_path)"
test -n "$DB_BACKUP_PATH"
test -f "$DB_BACKUP_PATH"
grep -E '^DB_BACKUP_PATH=' .rollback-meta.env
grep -E '^PREVIOUS_IMAGE_TAG=|^TARGET_IMAGE_TAG=|^DEPLOY_STARTED_AT=' .rollback-meta.env
```

## 9. Rollback rehearsal

По умолчанию для staging rehearsal использовать сценарий A: rollback только image/app. DB restore тестировать только если допустима потеря staging данных после pre-deploy backup.

Manual rollback workflow:

```bash
gh workflow run rollback-production.yml \
  --repo nilsnavi/fit_trackerpro \
  --ref main \
  -f environment=staging \
  -f rollback_image_tag='<previous-known-good-tag>' \
  -f rollback_restore_db=false
```

Manual SSH fallback:

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s|^IMAGE_TAG=.*|IMAGE_TAG=${PREVIOUS_IMAGE_TAG}|" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec -T backend curl -fsS http://localhost:8000/api/v1/system/ready
curl -fk https://localhost/health
curl -fk https://localhost/healthz
```

DB restore rehearsal только при явном разрешении:

```bash
cd ~/fittracker-pro
source .rollback-meta.env
test -n "$DB_BACKUP_PATH"
test -f "$DB_BACKUP_PATH"
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i fittracker-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DB_BACKUP_PATH"
```

## 10. Exit criteria

- GitHub Environment `staging` существует.
- Все обязательные staging secrets присутствуют.
- `image_tag` versioned и не `latest`.
- `deploy.yml` завершился успешно на `environment=staging`.
- Миграции и seed stage успешны.
- Health/readiness/version/frontend checks успешны.
- Telegram golden path пройден вручную.
- Backup file существует, `.rollback-meta.env` содержит `DB_BACKUP_PATH`.
- Rollback path проверен и результат зафиксирован.
