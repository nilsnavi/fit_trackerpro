# FitTracker Pro - Deployment Quick Reference

This file is a short operational reference for local and production deployment.

## Repository Layout

```text
fit_trackerpro/
├── backend/
├── frontend/
├── database/
├── docs/
├── monitoring/
├── nginx/
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Local Start (Docker)

```bash
git clone https://github.com/nilsnavi/fit_trackerpro.git
cd fit_trackerpro

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker-compose up -d
docker-compose exec backend alembic upgrade head
```

Endpoints:
- Frontend: `http://localhost`
- Backend API: `http://localhost:8000/api/v1`
- Swagger (debug only): `http://localhost:8000/docs`

## Local Start (without Docker)

```bash
# backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

```bash
# frontend
cd frontend
npm install
npm run dev
```

## Current Backend Architecture

- `backend/app/api` - HTTP endpoints only
- `backend/app/services` - business logic
- `backend/app/repositories` - database access
- `backend/app/schemas` - API contracts

## CI/CD (GitHub Actions)

Workflows in `.github/workflows`:
- `test.yml` - lint, type check, tests, security scan
- `build.yml` - build and push Docker images to GHCR
- `deploy.yml` - production deployment
- `migrate.yml` - manual migration operations

## Most Used Ops Commands

```bash
# logs
docker-compose logs -f
docker-compose -f docker-compose.prod.yml logs -f

# migrate
docker-compose exec backend alembic upgrade head
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# restart
docker-compose restart backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

## Required Environment Variables (minimum)

Backend:
- `DATABASE_URL`
- `DATABASE_URL_SYNC`
- `SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBAPP_URL`

Frontend:
- `VITE_API_URL`
- `VITE_TELEGRAM_BOT_USERNAME`

For the full list, use `docs/ENVIRONMENT_SETUP.md`.
