# FitTracker Pro - Рекомендации по запуску

## 📊 Текущий статус проекта

**Статус**: ✅ ПРОЕКТ ГОТОВ К ЗАПУСКУ

Все сервисы работают корректно на момент 2026-04-02 13:00 MSK.

## ✅ Проверенные компоненты

### Docker-контейнеры (все healthy):
- `fittracker-backend` (порт 18000) ✓
- `fittracker-frontend` (порт 18080) ✓
- `fittracker-postgres` (порт 15432) ✓
- `fittracker-redis` (порт 16379) ✓
- `fittracker-edge` (порт 19000) ✓

### API endpoints:
- `GET /api/v1/system/health` → `{"status": "healthy"}` ✓
- `GET /api/v1/system/version` → v1.0.0 ✓
- `GET /` → Фронтенд загружается ✓

### База данных:
- PostgreSQL 15.14 ✓
- 18 таблиц создано ✓
- Миграции выполнены ✓
- Пользователи есть в БД ✓

## 🎯 Быстрый старт (Docker)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/nilsnavi/fit_trackerpro.git
cd fit_trackerpro

# 2. Настроить окружение
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Отредактировать backend/.env:
#    - SECRET_KEY: сгенерировать случайную строку (минимум 32 символа)
#    - TELEGRAM_BOT_TOKEN: получить от @BotFather
#    - TELEGRAM_WEBAPP_URL: ваш публичный URL

# 4. Запустить весь стек
docker compose --env-file backend/.env --env-file frontend/.env up -d --build

# 5. Применить миграции
docker compose --env-file backend/.env --env-file frontend/.env exec backend alembic upgrade head

# 6. Проверить работу
curl http://localhost:18000/api/v1/system/health
curl http://localhost:18080/
```

## 🔧 Режимы разработки

### Вариант A: Полный Docker (рекомендуется)
Все сервисы в контейнерах, код бэкенда смонтирован как volume.

**Порты:**
- Backend API: http://localhost:18000
- Frontend: http://localhost:18080
- PostgreSQL: localhost:15432
- Redis: localhost:16379

### Вариант B: Гибридный (БД в Docker, код на хосте)

```bash
# 1. Запустить только инфраструктуру
docker compose up -d postgres redis

# 2. Бэкенд на хосте
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Unix
pip install -r requirements/dev.txt
cp .env.example .env
# В .env указать DATABASE_URL и REDIS_URL на localhost
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Фронтенд на хосте (в другом терминале)
cd frontend
npm install
cp .env.example .env
npm run dev
```

**Порты:**
- Backend API: http://localhost:8000
- Frontend: http://localhost:5173 (Vite)
- PostgreSQL: localhost:15432
- Redis: localhost:16379

## ⚠️ Типичные проблемы и решения

### 1. Ошибка подключения к базе данных

**Проблема**: 
```
DATABASE_URL=postgresql+asyncpg://...@localhost:15432/...
```
не работает при локальном запуске без Docker.

**Решение**:
- Для Docker: использовать порт из docker-compose.yml (15432)
- Для локальной разработки: использовать стандартный порт PostgreSQL (5432)

Создайте отдельный `.env.local` файл для локальной разработки:
```env
DATABASE_URL=postgresql+asyncpg://fittracker:fittracker_password@localhost:5432/fittracker
DATABASE_URL_SYNC=postgresql://fittracker:fittracker_password@localhost:5432/fittracker
REDIS_URL=redis://localhost:6379/0
```

### 2. Временные ngrok URL

**Проблема**: URL вида `https://postcardiac-uneruptive-dung.ngrok-free.dev` часто меняются.

**Решение**:
- Для локальной разработки используйте `http://localhost:5173`
- Для production настройте постоянный домен или стабильные туннели (ngrok paid, Cloudflare Tunnel)

Обновите `backend/.env`:
```env
TELEGRAM_WEBAPP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Телеграм бот не запускается

**Проблема**: В логах `TELEGRAM_BOT_TOKEN not set`

**Решение**:
1. Получить токен в @BotFather
2. Добавить в `backend/.env`:
   ```env
   TELEGRAM_BOT_TOKEN=1234567890:AABBccDDeeFFggHHiiJJkkLLmmNNooPPqq
   TELEGRAM_BOT_ENABLED=true
   ```

### 4. Ошибки CORS

**Проблема**: Фронтенд не может подключиться к API

**Решение**: Добавить URL фронтенда в `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:18080
```

### 5. Миграции не применяются

**Проблема**: Таблицы не создаются

**Решение**:
```bash
# Для Docker
docker compose exec backend alembic upgrade head

# Проверить состояние миграций
docker compose exec backend alembic current

# Если есть проблемы - посмотреть последние миграции
docker compose exec backend alembic history
```

## 🔐 Production checklist

Перед деплоем в production убедитесь:

- [ ] `ENVIRONMENT=production`
- [ ] `DEBUG=false`
- [ ] `SECRET_KEY` минимум 32 символа (уникальный)
- [ ] `DATABASE_URL` использует PostgreSQL (не SQLite)
- [ ] `TELEGRAM_BOT_TOKEN` установлен в реальное значение
- [ ] `TELEGRAM_WEBAPP_URL` указывает на production домен
- [ ] `ALLOWED_ORIGINS` не содержит `*`, перечислены конкретные HTTPS origin
- [ ] Выполнены миграции: `alembic upgrade head`
- [ ] Health check проходит: `GET /api/v1/system/health`
- [ ] Версия доступна: `GET /api/v1/system/version`

## 📁 Структура файлов окружения

### Backend (.env)
Обязательные:
- `SECRET_KEY` - JWT секрет (минимум 32 символа)
- `DATABASE_URL` - URL базы данных
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота
- `TELEGRAM_WEBAPP_URL` - публичный URL Mini App

Опциональные:
- `ENVIRONMENT` - development/test/production
- `DEBUG` - true/false
- `ALLOWED_ORIGINS` - CORS разрешённые origin
- `REDIS_URL` - Redis URL
- `SENTRY_DSN` - Sentry DSN для мониторинга ошибок

### Frontend (.env)
Обязательные:
- `VITE_API_URL` - URL API (например, http://localhost:8000/api/v1)

Опциональные:
- `VITE_ENVIRONMENT` - development/production
- `VITE_TELEGRAM_BOT_USERNAME` - username бота
- `VITE_SENTRY_DSN` - Sentry DSN
- `VITE_ENABLE_ANALYTICS` - включить аналитику
- `VITE_ENABLE_DEBUG_TOOLS` - инструменты отладки

## 🆘 Диагностика

### Проверка состояния сервисов
```bash
# Docker контейнеры
docker compose ps

# Логи бэкенда
docker logs fittracker-backend --tail 50

# Логи фронтенда
docker logs fittracker-frontend --tail 50

# Проверка API
curl http://localhost:18000/api/v1/system/health
curl http://localhost:18000/api/v1/system/version

# Проверка БД
docker exec fittracker-postgres psql -U fittracker -d fittracker -c "\dt"

# Проверка миграций
docker compose exec backend alembic current
```

### Тестовый пользователь
В базе данных уже есть пользователь:
- telegram_id: 224466587
- username: ekantser

Используйте его для тестирования через Telegram.

## 📚 Дополнительная документация

- [Основной README](../README.md)
- [Индекс документации](./DOCS_INDEX.md)
- [Локальная разработка](./local-development.md)
- [Деплой](./DEPLOYMENT.md)
- [Архитектура](./architecture.md)
- [Настройка окружения](./ENVIRONMENT_SETUP.md)
- [Production checklist](./PRODUCTION_CHECKLIST.md)
