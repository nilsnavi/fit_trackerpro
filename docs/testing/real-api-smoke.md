# Smoke против реального API (без моков) — настройка и ротация

**Workflow:** `.github/workflows/e2e-smoke-real.yml` (cron `0 3 * * *` + ручной `workflow_dispatch`)
**Спека:** `frontend/e2e/*.spec.ts` с тегом `@smoke-real` (`npm run e2e:smoke:real`)
**Задача плана:** WS1-6 (issue [#165](https://github.com/nilsnavi/fit_trackerpro/issues/165))

Это единственная проверка, что живой контур (staging/prod) реально отвечает: golden path
проходится по настоящему API и настоящему Telegram-входу, без моков и подставных ответов.
Поэтому workflow не удаляется — он либо прогоняется, либо честно пропускается.

## Поведение, если секреты не заведены

Job печатает предупреждение и завершается **успешно** со статусом «skipped»:

```
::warning::Smoke против реального API пропущен: не заданы секреты E2E_BASE_URL, ...
skipped: staging not configured — секреты E2E_* не заведены, прогон не выполнялся.
```

Ни один шаг (установка зависимостей, браузеры, сам прогон) не выполняется, поэтому ночной
workflow не «краснеет» и не приучает игнорировать падения. Как только секреты появятся,
тот же job начинает реально запускать smoke без правок workflow.

## Включение (вариант A: staging поднят)

Нужны три repository secrets (Settings → Secrets and variables → Actions):

| Секрет | Что это | Пример |
|--------|---------|--------|
| `E2E_BASE_URL` | URL фронтенда живого контура | `https://app.example.com` |
| `E2E_API_BASE_URL` | URL API того же контура | `https://api.example.com` |
| `E2E_TELEGRAM_INIT_DATA` | Подписанная строка `initData` тестового Telegram-пользователя | `user=...&auth_date=...&hash=...` |

Ручной запуск и проверка:

```bash
gh workflow run "E2E Smoke Real API" --repo nilsnavi/fit_trackerpro
gh run list --repo nilsnavi/fit_trackerpro --workflow "E2E Smoke Real API" --limit 3
gh run view <run-id> --log          # шаг «Run smoke golden path (real API)»
```

### Как получить `E2E_TELEGRAM_INIT_DATA`

**Способ 1 — реальный тестовый аккаунт (быстро, но живёт < 24 часов).**
Откройте Mini App из чата с ботом под тестовым аккаунтом и снимите
`window.Telegram.WebApp.initData` (консоль WebView/устройства или временный туннель к
dev-сборке). Значение — одна строка, её и кладут в секрет.

**Способ 2 — выделенный smoke-бот (долговременно).**
Если живой контур умеет принимать вход от отдельного бота, `initData` не нужно хранить:
его печатает тестовый хелпер `backend/app/tests/telegram_webapp.py::build_init_data`
по токену этого бота. Тогда в CI достаточно держать токен и `id` пользователя, а строку
генерировать перед прогоном:

```bash
cd backend && python - <<'PY'
import sys, json
sys.path.insert(0, ".")
from app.tests.telegram_webapp import build_init_data
print(build_init_data(
    bot_token="<SMOKE_BOT_TOKEN>",
    user={"id": 111111111, "first_name": "Smoke", "username": "smoke_user"},
))
PY
```

> Важно: `auth_date` подписи должен быть свежим — бэкенд отклоняет вход старше 24 часов
> (`validate_init_data_with_age`, `max_age_seconds = 86400`) и даёт на это понятную ошибку.
> Поэтому способ 1 требует обновлять секрет **перед каждым прогоном**, способ 2 — нет.

## Ротация и сопровождение

| Что | Когда | Как |
|-----|-------|-----|
| `E2E_TELEGRAM_INIT_DATA` (способ 1) | перед ручным прогоном; ночной smoke требует свежих данных ежедневно | перевыпустить из тестового аккаунта и обновить секрет |
| Токен smoke-бота (способ 2) | при компрометации/смене бота | BotFather → `/revoke`, обновить секреты и перевыпустить `initData` |
| `E2E_BASE_URL` / `E2E_API_BASE_URL` | при переезде контура | обновить секреты, запустить workflow вручную |

## Если smoke снова красный

1. **«Данные Telegram устарели (более 24 часов)»** — обновите `E2E_TELEGRAM_INIT_DATA`
   (способ 1) либо перейдите на способ 2.
2. **«Подпись Telegram initData недействительна»** — подпись выпущена другим бот-токеном,
   чем тот, с которым работает контур. Сверьте `TELEGRAM_BOT_TOKEN` окружения.
3. **Всё падает на открытии страницы** — проверьте `E2E_BASE_URL`/`E2E_API_BASE_URL` и
   `GET {E2E_API_BASE_URL}/api/v1/system/ready`: `503 degraded` означает, что не готовы
   Postgres/Redis, а не что сломался smoke.
4. **Нужно снять шум, не теряя проверку** — удалите секреты: workflow вернётся в режим
   честного пропуска с предупреждением (см. выше), ручной запуск остаётся доступен.
