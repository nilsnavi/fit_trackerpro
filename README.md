# FitTracker Pro

Telegram Mini App для отслеживания фитнеса и здоровья. Полноценное приложение с системой достижений, аналитикой тренировок, отслеживанием здоровья и экстренным режимом.

## Структура проекта

```
fit_trackerpro/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Python FastAPI
├── database/          # PostgreSQL миграции
├── monitoring/        # Prometheus + Grafana
├── nginx/             # Nginx конфигурация
├── docs/              # Документация
└── .github/workflows/ # CI/CD пайплайны
```

## Технологии

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- TanStack Query
- Telegram Mini Apps SDK
- Jest + React Testing Library

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL
- Redis
- Pytest

### DevOps
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- Prometheus + Grafana
- Sentry (error tracking)
- Nginx (reverse proxy)

## Database Architecture Notes

- Snake-case migration and zero-downtime runbook: `database/postgresql/migrations/README_zero_downtime_snake_case.md`
- Partitioning policy (deferred until growth stage): `database/postgresql/PARTITIONING_POLICY.md`

## Быстрый старт

### Docker (рекомендуется)

```bash
# Клонирование репозитория
git clone https://github.com/yourusername/fittracker-pro.git
cd fittracker-pro

# Настройка окружения
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Отредактируйте .env файлы

# Запуск всех сервисов
docker-compose up -d

# Применение миграций
docker-compose exec backend alembic upgrade head
```

Приложение будет доступно:
- Frontend: http://localhost
- Backend API: http://localhost:8000/api/v1
- API Docs: http://localhost:8000/docs

### Локальная разработка

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Тестирование

```bash
# Frontend тесты
cd frontend
npm test
npm run test:coverage  # с покрытием

# Backend тесты
cd backend
pytest
pytest --cov=app --cov-report=html  # с покрытием
```

Требования к покрытию: минимум 80%

## Переменные окружения

### Backend (.env)
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/fittracker
DATABASE_URL_SYNC=postgresql://user:password@localhost:5432/fittracker
REDIS_URL=redis://localhost:6379/0
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBAPP_URL=https://yourdomain.com
SECRET_KEY=your_secret_key
ENVIRONMENT=development
DEBUG=true
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
SENTRY_DSN=your_sentry_dsn
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
VITE_ENVIRONMENT=development
VITE_SENTRY_DSN=your_sentry_dsn
```

## Backend архитектура

Backend приведен к слоистой структуре:

- `app/api` — только HTTP слой (роутинг, валидация входа, коды ответов)
- `app/services` — бизнес-логика и orchestration сценариев
- `app/repositories` — доступ к БД (SQLAlchemy запросы)
- `app/schemas` — контракты запросов/ответов (Pydantic)
- `app/models` — ORM модели

Это упрощает поддержку, тестирование и дальнейшие изменения без дублирования логики в роутерах.

## API Endpoints (актуально)

### Health & System
- `GET /api/v1/health` - Health check
- `GET /` - API info

### Authentication
- `POST /api/v1/auth/telegram` - Telegram WebApp auth

### Users
- `GET /api/v1/users/*` - в разработке (часть endpoint-ов пока заглушки)

### Workouts
- `GET /api/v1/workouts/templates` - Список шаблонов
- `POST /api/v1/workouts/templates` - Создать шаблон
- `GET /api/v1/workouts/templates/{template_id}` - Получить шаблон
- `PUT /api/v1/workouts/templates/{template_id}` - Обновить шаблон
- `DELETE /api/v1/workouts/templates/{template_id}` - Удалить шаблон
- `GET /api/v1/workouts/history` - История тренировок
- `GET /api/v1/workouts/history/{workout_id}` - Детали тренировки
- `POST /api/v1/workouts/start` - Начать тренировку
- `POST /api/v1/workouts/complete` - Завершить тренировку

### Exercises
- `GET /api/v1/exercises/` - List exercises
- `GET /api/v1/exercises/{id}` - Get exercise details
- `POST /api/v1/exercises/` - Создать упражнение
- `PUT /api/v1/exercises/{id}` - Обновить упражнение (admin)
- `DELETE /api/v1/exercises/{id}` - Удалить упражнение (admin)
- `POST /api/v1/exercises/{id}/approve` - Одобрить упражнение (admin)

### Health Metrics
- `GET /api/v1/health_metrics/*` - в разработке (заглушки)

### Health
- `POST /api/v1/health/glucose` - Добавить запись глюкозы
- `GET /api/v1/health/glucose` - История глюкозы
- `GET /api/v1/health/glucose/{log_id}` - Детали записи глюкозы
- `DELETE /api/v1/health/glucose/{log_id}` - Удалить запись глюкозы
- `POST /api/v1/health/wellness` - Создать/обновить wellness
- `GET /api/v1/health/wellness` - История wellness
- `GET /api/v1/health/wellness/{entry_id}` - Детали wellness
- `GET /api/v1/health/stats` - Сводная статистика

### Analytics
- `GET /api/v1/analytics/training-load/daily`
- `GET /api/v1/analytics/training-load/daily/table`
- `GET /api/v1/analytics/muscle-load`
- `GET /api/v1/analytics/muscle-load/table`
- `GET /api/v1/analytics/recovery-state`
- `POST /api/v1/analytics/recovery-state/recalculate`
- `GET /api/v1/analytics/progress`
- `GET /api/v1/analytics/calendar`
- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/muscle-signals`
- `POST /api/v1/analytics/export`
- `GET /api/v1/analytics/export/{export_id}`

### Achievements
- `GET /api/v1/achievements/` - List achievements
- `GET /api/v1/achievements/user` - User achievements
- `GET /api/v1/achievements/user/{achievement_id}` - Achievement details
- `POST /api/v1/achievements/{achievement_id}/claim` - Claim achievement
- `GET /api/v1/achievements/leaderboard` - Leaderboard

### Challenges
- `GET /api/v1/challenges/` - List challenges
- `GET /api/v1/challenges/{challenge_id}` - Challenge details
- `POST /api/v1/challenges/` - Create challenge
- `POST /api/v1/challenges/{id}/join` - Join challenge
- `POST /api/v1/challenges/{id}/leave` - Leave challenge
- `GET /api/v1/challenges/{id}/leaderboard` - Leaderboard
- `GET /api/v1/challenges/my/active` - Active user challenges

### Emergency
- `GET /api/v1/emergency/contact` - Список контактов
- `POST /api/v1/emergency/contact` - Создать контакт
- `GET /api/v1/emergency/contact/{contact_id}` - Детали контакта
- `PUT /api/v1/emergency/contact/{contact_id}` - Обновить контакт
- `DELETE /api/v1/emergency/contact/{contact_id}` - Удалить контакт
- `POST /api/v1/emergency/notify` - Экстренное оповещение
- `POST /api/v1/emergency/notify/workout-start` - Оповещение о старте тренировки
- `POST /api/v1/emergency/notify/workout-end` - Оповещение о завершении тренировки
- `GET /api/v1/emergency/settings` - Настройки emergency
- `POST /api/v1/emergency/log` - Лог emergency события

## Деплой

См. подробную документацию:
- [Руководство по деплою](docs/DEPLOYMENT.md)
- [Настройка окружения](docs/ENVIRONMENT_SETUP.md)
- [Чеклист безопасности](docs/SECURITY_CHECKLIST.md)
- [Чеклист production](docs/PRODUCTION_CHECKLIST.md)

### Быстрый деплой на VPS

```bash
# На сервере
git clone https://github.com/yourusername/fittracker-pro.git
cd fittracker-pro

# Настройка окружения
cp .env.example .env
# Отредактируйте .env

# Запуск production
docker-compose -f docker-compose.prod.yml up -d

# Миграции
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## CI/CD

CI настроен через **GitHub Actions** (каталог `.github/workflows/`). Отдельного GitLab CI в репозитории нет.

Пайплайны:
- **test.yml** — тесты на push/PR
- **build.yml** — сборка Docker-образов
- **deploy.yml** — деплой на production
- **migrate.yml** — управление миграциями

## Мониторинг

- **Sentry** - Отслеживание ошибок
- **Prometheus** - Метрики
- **Grafana** - Визуализация

Запуск мониторинга:
```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

## Функции приложения

- **Тренировки** - Создание и отслеживание тренировок
- **Упражнения** - Каталог упражнений с инструкциями
- **Аналитика** - Прогресс, статистика, OneRM калькулятор
- **Достижения** - Система геймификации
- **Челленджи** - Групповые испытания
- **Здоровье** - Глюкоза, вода, wellness check-in
- **Экстренный режим** - Быстрый доступ к важным данным

## Лицензия

MIT
