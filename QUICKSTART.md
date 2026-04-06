# FitTracker Pro - Шпаргалка по запуску ⚡

## 🚀 Быстрый старт (2 команды)

```bash
# 1. Настроить окружение
cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env

# 2. Запустить Docker
docker compose --env-file backend/.env --env-file frontend/.env up -d --build
```

Миграции теперь применяются автоматически сервисом `migrator` перед запуском backend.

**Готово!** Проверяем:
- API: http://localhost:18000/api/v1/system/health ✅
- Фронтенд: http://localhost:18080 ✅

---

## 🔧 Минимальная конфигурация

### backend/.env (обязательно)
```env
SECRET_KEY=dfa870c55c27fd4f3cc2bed818201bd241cf98ee7a5525018367530961cc15a5
TELEGRAM_BOT_TOKEN=8717783920:AAFQG3n4DTwgNcJxCSG9ij1l3IP5ovqegY
TELEGRAM_WEBAPP_URL=http://localhost:5173
DATABASE_URL=postgresql+asyncpg://fittracker:fittracker_password@postgres:5432/fittracker
REDIS_URL=redis://redis:6379/0
ENVIRONMENT=development
DEBUG=true
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:18080
```

### frontend/.env (обязательно)
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_ENVIRONMENT=development
```

---

## 📊 Порты сервисов

| Сервис | Порт (хост) | Порт (контейнер) | URL |
|--------|-------------|------------------|-----|
| Frontend | 18080 | 80 | http://localhost:18080 |
| Backend API | 18000 | 8000 | http://localhost:18000 |
| PostgreSQL | 15432 | 5432 | localhost:15432 |
| Redis | 16379 | 6379 | localhost:16379 |
| Edge Proxy | 19000 | 80 | http://localhost:19000 |

---

## 🆘 Если что-то не работает

### Бэкенд не запускается
```bash
# Посмотреть логи
docker logs fittracker-backend

# Перезапустить
docker compose restart backend

# Проверить подключение к БД
docker exec fittracker-backend python -c "from app.infrastructure.database import init_db; import asyncio; asyncio.run(init_db())"
```

### Фронтенд не загружается
```bash
# Посмотреть логи
docker logs fittracker-frontend

# Пересобрать
docker compose build frontend
docker compose restart frontend
```

### Ошибки базы данных
```bash
# Проверить миграции
docker compose logs migrator

# Применить заново
docker compose run --rm migrator
```

### Сбросить всё и начать заново
```bash
# Остановить и удалить контейнеры с volumes
docker compose down -v

# Поднять заново
docker compose up -d --build
```

---

## 🧪 Тестирование

```bash
# Health check
curl http://localhost:18000/api/v1/system/health

# Версия
curl http://localhost:18000/api/v1/system/version

# Swagger UI (если DEBUG=true)
open http://localhost:18000/docs

# Фронтенд
open http://localhost:18080
```

---

## ✅ Модерация упражнений

- Новое упражнение из формы добавления попадает в статус `pending` и публикуется только после модерации.
- Подтверждение публикации выполняет администратор через approve-эндпоинт.
- Доступ к approve-эндпоинту есть только у пользователей, чьи Telegram ID указаны в `ADMIN_USER_IDS`.
- Настройка выполняется в `backend/.env`:

```env
ADMIN_USER_IDS=123456789,987654321
```

---

## 📝 Production deployment

```bash
# 1. Собрать образы
docker compose -f docker-compose.prod.yml build

# 2. Применить миграции
docker compose -f docker-compose.prod.yml run backend alembic upgrade head

# 3. Запустить
docker compose -f docker-compose.prod.yml up -d

# 4. Проверить
curl http://localhost:18000/api/v1/system/health
curl http://localhost:18000/api/v1/system/version
```

⚠️ **Важно**: В production обязательно установите:
- `ENVIRONMENT=production`
- `DEBUG=false`
- Уникальный `SECRET_KEY` (минимум 32 символа)
- Реальный `TELEGRAM_BOT_TOKEN`
- Правильный `TELEGRAM_WEBAPP_URL` (ваш домен)
- `ALLOWED_ORIGINS` без wildcard `*`

---

## 📚 Полная документация

- [LAUNCH_GUIDE.md](./LAUNCH_GUIDE.md) - развёрнутая инструкция
- [README.md](./README.md) - основная документация
- [docs/deployment.md](./docs/deployment.md) - production деплой
- [docs/local-development.md](./docs/local-development.md) - локальная разработка
