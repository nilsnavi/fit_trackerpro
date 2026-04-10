# Local development

Этот документ — канонический гайд по локальному запуску FitTracker Pro.

## Быстрый старт (Docker Compose)

```bash
git clone https://github.com/nilsnavi/fit_trackerpro.git
cd fit_trackerpro

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose --env-file backend/.env --env-file frontend/.env up -d --build
docker compose --env-file backend/.env --env-file frontend/.env exec backend alembic upgrade head
```

Доступ:

- Фронтенд (Nginx): `http://localhost`
- API бэкенда: `http://localhost:8000/api/v1`
- Swagger (при `DEBUG=true` у бэкенда): `http://localhost:8000/docs`

## Гибридный режим: backend+frontend на хосте, БД/Redis в Docker

Требования: **Python 3.11+**, **Node.js 20+**, **PostgreSQL 15**, **Redis 7**.

1) Поднять только инфраструктуру:

```bash
docker compose up -d postgres redis
```

2) Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix/macOS: source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3) Frontend (в другом терминале):

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:8000/api/v1
npm run dev
```

Vite по умолчанию: `http://localhost:5173`. Убедитесь, что этот origin добавлен в `ALLOWED_ORIGINS` в `backend/.env`.

## Переменные окружения (канон)

- Локальная разработка: `backend/.env` и `frontend/.env` на базе `*.env.example`
- Полный перечень переменных и где они используются: `docs/env-matrix.md`
- Telegram Mini App и auth flow: `docs/product/telegram-setup.md`

## Быстрые проверки

```bash
curl -fsS http://localhost:8000/api/v1/system/health
curl -fsS http://localhost:8000/api/v1/system/version
```

