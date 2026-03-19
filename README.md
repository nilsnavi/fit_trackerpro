# FitTracker Pro

Telegram Mini App для отслеживания фитнеса и здоровья. Полноценное приложение с системой достижений, аналитикой тренировок, отслеживанием здоровья и экстренным режимом.

## Структура проекта

```
fittracker-pro/
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

## API Endpoints

### Health & System
- `GET /api/v1/health` - Health check
- `GET /` - API info

### Authentication
- `POST /api/v1/auth/telegram` - Telegram WebApp auth

### Users
- `GET /api/v1/users/me` - Current user profile
- `PATCH /api/v1/users/me` - Update profile

### Workouts
- `GET /api/v1/workouts/` - List workouts
- `POST /api/v1/workouts/` - Create workout
- `GET /api/v1/workouts/{id}` - Get workout details
- `PUT /api/v1/workouts/{id}` - Update workout
- `DELETE /api/v1/workouts/{id}` - Delete workout

### Exercises
- `GET /api/v1/exercises/` - List exercises
- `GET /api/v1/exercises/{id}` - Get exercise details

### Health Metrics
- `GET /api/v1/health/` - List health metrics
- `POST /api/v1/health/` - Create health metric
- `GET /api/v1/health/glucose` - Glucose logs
- `GET /api/v1/health/wellness` - Wellness check-ins

### Analytics
- `GET /api/v1/analytics/dashboard` - Dashboard stats
- `GET /api/v1/analytics/progress` - Progress data
- `GET /api/v1/analytics/onerm` - OneRM calculator

### Achievements
- `GET /api/v1/achievements/` - List achievements
- `GET /api/v1/achievements/my` - User achievements

### Challenges
- `GET /api/v1/challenges/` - List challenges
- `POST /api/v1/challenges/{id}/join` - Join challenge

### Emergency
- `POST /api/v1/emergency/activate` - Activate emergency mode
- `POST /api/v1/emergency/deactivate` - Deactivate emergency mode
- `GET /api/v1/emergency/contacts` - Emergency contacts

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

Пайплайны GitHub Actions:
- **test.yml** - Тесты на push/PR
- **build.yml** - Сборка Docker образов
- **deploy.yml** - Деплой на production
- **migrate.yml** - Управление миграциями

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
