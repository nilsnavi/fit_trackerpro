# Launch Runbook: P0-выход в прод (WS1-7…WS1-11, WS1-15)

**Для кого:** владелец репозитория/оператор (нужны права на Settings, сервер, BotFather).
**Зачем:** эти шаги нельзя выполнить из песочницы — им нужны доступы, сервер и GitHub Environments.
Порядок обязателен: каждый следующий шаг опирается на артефакты предыдущего.
**План и acceptance:** `docs/roadmap/production-remediation-plan-2026-09-23.md` (WS1-7…WS1-11, WS1-15),
issues [#166](https://github.com/nilsnavi/fit_trackerpro/issues/166)–[#170](https://github.com/nilsnavi/fit_trackerpro/issues/170),
[#174](https://github.com/nilsnavi/fit_trackerpro/issues/174).

Детали по конкретным темам не дублируются, а лежат рядом:
`docs/DEPLOYMENT.md` (последовательность деплоя и smoke), `docs/STAGING_DEPLOYMENT_REHEARSAL.md`
(репетиция staging по шагам), `docs/ROLLBACK_STRATEGY.md` + `docs/ROLLBACK_ONCALL_CHEATSHEET.md` (откат),
`docs/env-matrix.md` (все переменные), `docs/PRODUCTION_CHECKLIST.md` (go/no-go).
**Telegram-специфика P0:** `docs/testing/real-api-smoke.md` (WS1-6) и §«Бот» ниже (WS1-12/WS1-15).

---

## 0. Preflight: код готов и CI зелёный

```bash
# Ветка WS1 влита в main (PR #191), main зелёный по Test/Security/Build
gh pr view 191 --repo nilsnavi/fit_trackerpro --json state,mergeable,headRefOid
gh run list --repo nilsnavi/fit_trackerpro --branch main --limit 10 \
  --json workflowName,status,conclusion,headSha
```

Гейт: `Test` и `Security` на `main` — `success`; все правки WS1-1…WS1-6, WS1-12…WS1-14 в `main`.
Отдельно проверьте, что версия правовых документов на фронте и бэке одинаковая
(`frontend/src/features/legal/versions.ts` ↔ `backend/app/core/legal.py`) — это инвариант WS1-14.

---

## 1. WS1-7 · Собрать и зафиксировать образы `main` ([#166](https://github.com/nilsnavi/fit_trackerpro/issues/166))

```bash
# Сборка запускается автоматически на push в main; ручной запуск, если нужно повторить:
gh workflow run build.yml --repo nilsnavi/fit_trackerpro --ref main
gh run list --repo nilsnavi/fit_trackerpro --workflow "Build and Push" --limit 3

# Тег формирует docker/metadata-action как sha с префиксом ветки: main-<short_sha>
SHA=$(gh api repos/nilsnavi/fit_trackerpro/commits/main --jq '.sha[0:7]')
echo "Ожидаемый тег: main-${SHA}"

# Проверка образов (любая машина с docker):
docker manifest inspect ghcr.io/nilsnavi/fit_trackerpro/backend:main-${SHA} > /dev/null && echo backend-ok
docker manifest inspect ghcr.io/nilsnavi/fit_trackerpro/frontend:main-${SHA} > /dev/null && echo frontend-ok
```

Гейт: оба образа существуют в GHCR и просканированы Trivy без `critical`.
Откат: не требуется (ничего не выкатывалось).

---

## 2. WS1-8 · GitHub Environments и секреты ([#167](https://github.com/nilsnavi/fit_trackerpro/issues/167))

Environment `staging` — первый, `production` — с **required reviewers** (и, по желанию,
branch policy `main`):

```bash
gh api -X PUT repos/nilsnavi/fit_trackerpro/environments/staging
gh api -X PUT repos/nilsnavi/fit_trackerpro/environments/production

# Обязательные секреты (14 имён) — по одному в каждый environment:
#   POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SECRET_KEY
#   TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET TELEGRAM_WEBAPP_URL
#   ALLOWED_ORIGINS VITE_API_URL VITE_TELEGRAM_BOT_USERNAME
#   SSH_PRIVATE_KEY DEPLOY_HOST DEPLOY_USER
for env in staging production; do
  for name in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SECRET_KEY \
              TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET TELEGRAM_WEBAPP_URL \
              ALLOWED_ORIGINS VITE_API_URL VITE_TELEGRAM_BOT_USERNAME \
              SSH_PRIVATE_KEY DEPLOY_HOST DEPLOY_USER; do
    gh secret set "$name" --env "$env" --repo nilsnavi/fit_trackerpro   # значения спрашиваются интерактивно
  done
done
```

Требования к значениям:
* `TELEGRAM_WEBHOOK_SECRET` — 16+ символов из `A-Za-z0-9_-` (Bot API ограничивает 1…256 такими
  символами; бэкенд в проде отвергает короткий секрет). Сгенерировать:
  `openssl rand -hex 32`. Это тот же секрет, что проверяет `/telegram/webhook` по заголовку
  `X-Telegram-Bot-Api-Secret-Token`;
* `TELEGRAM_WEBAPP_URL` — `https://<домен>/`;
* `SSH_PRIVATE_KEY` — deploy-ключ без пароля, `DEPLOY_USER` имеет доступ к `~/fittracker-pro`.

Проверка: `gh api repos/nilsnavi/fit_trackerpro/environments` показывает оба environment,
а `scripts/staging-rehearsal.ps1` (без `-Dispatch`) проходит без ошибок.
Откат: удалить environment (`gh api -X DELETE .../environments/<name>`) — но это остановит деплой.

---

## 3. WS1-9 · Сервер(ы) ([#168](https://github.com/nilsnavi/fit_trackerpro/issues/168))

Чек-лист на каждой машине (прод и staging — **разные** каталоги, домены, БД и боты):

```bash
# Docker/Compose, git, curl; каталог деплоя
cd ~/fittracker-pro && docker compose -f docker-compose.prod.yml config --quiet && echo compose-ok

# TLS: NGINX_SSL_DIR=/etc/letsencrypt/live/<domain> (fullchain.pem + privkey.pem), автопродление активно
# Бэкапы: BACKUPS_DIR=/var/backups/fittracker вне репозитория, владелец — пользователь деплоя
# Firewall: снаружи только 22/80/443; Postgres/Redis НЕ публикуются наружу (так и в compose)
# Домен/DNS: фронт и API за одним edge-nginx; TELEGRAM_WEBAPP_URL = https://<domain>/
# BotFather: Menu Button → TELEGRAM_WEBAPP_URL
```

Гейт: `docker compose ... config --quiet` проходит, `443` отвечает, тест-контейнер `hello-world` работает.
Откат: n/a (подготовка окружения).

---

## 4. WS1-10 · Staging: первый полный выкат ([#169](https://github.com/nilsnavi/fit_trackerpro/issues/169))

```bash
gh workflow run deploy.yml --repo nilsnavi/fit_trackerpro \
  -f environment=staging -f image_tag=main-${SHA} -f rollback_restore_db=false
gh run watch "$(gh run list --repo nilsnavi/fit_trackerpro --workflow Deploy --limit 1 --json databaseId --jq '.[0].databaseId')"
```

DAG, который должен пройти целиком: `pre-deploy-validate` → backup БД → `alembic upgrade head` →
`seed_reference_data apply` → `up -d` → опрос `/api/v1/system/ready` (до 120 с) → `verify` smoke →
запись stable-тега.

Артефакты на сервере: `.rollback-meta.env` (в т.ч. `DB_BACKUP_PATH`), `.last-stable-deploy.env`
(`LAST_STABLE_IMAGE_TAG`, `LAST_STABLE_PREVIOUS_TAG`).

Ручная приёмка на staging (тестовый бот, тестовый аккаунт):

1. вход через Telegram Mini App — согласие на обработку данных о здоровье обязательно,
   без него профиль не сохраняется (400 `consent_required`);
2. шаблон → старт тренировки → подходы → завершение → история и аналитика;
3. офлайн: авиарежим → подход → вернуть сеть → синхронизация восстановилась;
4. профиль: замеры, экспорт данных (`GET /users/export`), удаление аккаунта на отдельном тесте;
5. экстренные контакты: контакт подключается в боте (`/link <код>`), после этого «Мне плохо»
   доставляет уведомление; для неподключённого контакта UI честно пишет «не доставлено».

Гейт: стек healthy, smoke зелёный, golden path пройден, скриншоты/логи приложены к issue.
Откат: `gh workflow run rollback-production.yml -f environment=staging ... -f confirm=ROLLBACK` (см. шаг 5).

---

## 5. WS1-11 · Репетиция rollback и восстановления БД ([#170](https://github.com/nilsnavi/fit_trackerpro/issues/170))

Все три сценария — **на staging**, до прода. Тайминги (фактические минуты) вписать в
`docs/ROLLBACK_ONCALL_CHEATSHEET.md`.

```bash
# Сценарий A: откат только образа
gh workflow run rollback-production.yml --repo nilsnavi/fit_trackerpro \
  -f environment=staging -f rollback_image_tag=<предыдущий тег> \
  -f rollback_restore_db=false -f confirm=ROLLBACK

# Сценарий B: проверка downgrade на живых данных
gh workflow run migrate.yml --repo nilsnavi/fit_trackerpro \
  -f command=downgrade -f revision=-1
# затем возврат: -f command=upgrade -f revision=head

# Сценарий C (безопасно): восстановить дамп из DB_BACKUP_PATH в ОТДЕЛЬНУЮ тестовую БД
ssh "$DEPLOY_USER@$DEPLOY_HOST" 'cd ~/fittracker-pro-staging && set -a && . ./.rollback-meta.env && set +a && \
  createdb fittracker_restore_check && \
  gunzip -c "$DB_BACKUP_PATH" | psql fittracker_restore_check >/dev/null && \
  psql -d fittracker_restore_check -c "select count(*) from workouts;"'
```

Гейт: A — сервис поднялся на предыдущем теге и smoke прошёл; B — `downgrade -1` и возврат на `head`
прошли; C — ключевые таблицы читаются из восстановленного дампа. Повторный deploy возвращает staging
на актуальный тег. Откат: сам деплой поверх (шаг 4).

---

## 6. WS1-15 · Релиз `v1.0.0` → production ([#174](https://github.com/nilsnavi/fit_trackerpro/issues/174))

Предусловия: шаги 1–5 пройдены, `docs/PRODUCTION_CHECKLIST.md` без исключений, Go/No-Go из плана — «Go».

```bash
# Тег на коммите main, который прошёл staging
gh release create v1.0.0 --repo nilsnavi/fit_trackerpro --target main \
  --title "v1.0.0 — первый продовый релиз" \
  --notes "P0-блок WS1 закрыт: безопасность, легальный минимум, реальная доставка уведомлений, CI."
# Публикация релиза сама триггерит deploy.yml (release: published → environment=production)
gh run list --repo nilsnavi/fit_trackerpro --workflow Deploy --limit 3
```

1. Подтвердить деплой в ручном approval (`production` с required reviewers) и дождаться успеха `verify`.
2. Сразу после выката: BotFather — Menu Button на `TELEGRAM_WEBAPP_URL`, `/start` в боте;
   проверить `getWebhookInfo`: URL вебхука и то, что Telegram реально доставляет updates.
3. Smoke прода: `GET https://<api>/api/v1/system/{health,ready,version}` (`ready` = Postgres + Redis,
   иначе `503 degraded`), фронт `/healthz`, вход через Telegram.
4. Ручная приёмка по списку из шага 4 (на продовом аккаунте, тестовый аккаунт потом удалить).
5. Проверить, что `SENTRY_DSN` работает (WS3-4) и бэкап перед миграцией создан.
6. Зафиксировать stable-тег и провести короткий разбор: что заняло больше времени, что автоматизировать.

Гейт (acceptance WS1-15): прод отдаёт health/ready/version, Mini App работает вживую, бот отвечает,
события идут в Sentry, бэкап перед миграцией есть, `gh release view v1.0.0` показывает релиз.
Откат: `gh workflow run rollback-production.yml -f environment=production -f confirm=ROLLBACK`
(в `.rollback-meta.env` есть `PREVIOUS_IMAGE_TAG`; восстановление БД — только при порче данных).

---

## 7. Что делать, если гейт не пройден

| Симптом | Причина | Действие |
|---------|---------|----------|
| `pre-deploy-validate`: «Required secret … is empty» | не заведён один из 14 секретов environment | добавить секрет, повторить запуск |
| `IMAGE_TAG must be non-empty and must not be 'latest'` | передан `latest` | взять тег `main-<sha>`/`v1.0.0` из GHCR |
| `ready` отвечает `503 degraded` | не готoвы Postgres/Redis или пустые креды | `docker compose logs`, проверить `POSTGRES_*`, `REDIS_URL` |
| Вебхук бота отвечает `403` | `TELEGRAM_WEBHOOK_SECRET` в Bot API и в окружении разошлись | `setWebhook` с тем же `secret_token`, либо обновить секрет окружения |
| Ежедневный «E2E Smoke Real API» пропущен | не заданы `E2E_*` (это ожидаемое поведение WS1-6) | см. `docs/testing/real-api-smoke.md` |
| Rollback: «No previous IMAGE_TAG in .rollback-meta.env» | первый деплой в environment | откатывать нечем — фиксировать инцидент, восстанавливать вперёд |

## 8. Что после запуска

P1-работы (WS2/WS3) продолжаются по плану; из P0 в проде остаётся только мониторинг
(`monitoring/` в корне репозитория), ротация секретов и проверка восстановления бэкапов по расписанию.
