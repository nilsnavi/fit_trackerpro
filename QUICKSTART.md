# FitTracker Pro — быстрый старт

Минимальные шаги, чтобы поднять стек локально через Docker. Подробности: [README.md](./README.md), индекс документации: [docs/DOCS_INDEX.md](./docs/DOCS_INDEX.md).

## 1. Клонировать и скопировать env

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## 2. Заполнить секреты (обязательно)

В **`backend/.env`** задайте:

- `SECRET_KEY` — случайная строка ≥ 32 символов (например: `python -c "import secrets; print(secrets.token_hex(32))"`).
- `TELEGRAM_BOT_TOKEN` — токен бота от [@BotFather](https://t.me/BotFather) (для Mini App).

Не коммитьте реальные значения и не вставляйте их в документацию.

## 3. Запустить Docker Compose

```bash
docker compose --env-file backend/.env --env-file frontend/.env up -d --build
```

При необходимости миграции (если в вашей конфигурации нет автоматического migrator):

```bash
docker compose --env-file backend/.env --env-file frontend/.env exec backend alembic upgrade head
```

## 4. Проверка

| Что | URL |
|-----|-----|
| API (health) | http://localhost:18000/api/v1/system/health |
| Swagger (если `DEBUG=true`) | http://localhost:18000/docs |
| Фронтенд (Nginx) | http://localhost:18080 |

## Frontend API URL (Docker)

С хоста браузер ходит на опубликованный порт бэкенда. В **`frontend/.env`** для этого сценария используйте:

```env
VITE_API_URL=http://localhost:18000/api/v1
```

Для чистого `npm run dev` на хосте (порт 8000) см. [README.md](./README.md) (вариант B).

## DEV-скрипты (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-up.ps1
```

Подробнее: [docs/local-development.md](./docs/local-development.md).

## Дополнительно

- [LAUNCH_GUIDE.md](./LAUNCH_GUIDE.md) — развёрнутая инструкция.
- [CHECKLIST.md](./CHECKLIST.md) — чеклист готовности.
- [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) — настройка Telegram Mini App.
