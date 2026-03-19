# FitTracker Pro - DevOps & Deployment

This document provides a quick reference for deploying and managing FitTracker Pro.

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/yourusername/fittracker-pro.git
cd fittracker-pro

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your values

# 3. Run locally with Docker
docker-compose up -d

# 4. Access the app
# Frontend: http://localhost
# Backend API: http://localhost:8000/api/v1
# API Docs: http://localhost:8000/docs
```

## Project Structure

```
fittracker-pro/
├── backend/              # FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   └── app/
├── frontend/             # React + Vite frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── jest.config.js
│   └── src/
├── database/             # Migrations and schema
├── monitoring/           # Prometheus + Grafana
├── nginx/                # Nginx configuration
├── docs/                 # Documentation
├── docker-compose.yml    # Development
├── docker-compose.prod.yml  # Production
└── .github/workflows/    # CI/CD pipelines
```

## Available Commands

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

### Testing

```bash
# Frontend tests
cd frontend
npm test
npm run test:coverage

# Backend tests
cd backend
pytest
pytest --cov=app --cov-report=html
```

### Database

```bash
# Create migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Run migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# Backup database
docker exec fittracker-postgres pg_dump -U fittracker fittracker > backup.sql

# Restore database
docker exec -i fittracker-postgres psql -U fittracker -d fittracker < backup.sql
```

### Production

```bash
# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Update production
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Environment Variables

### Required Backend Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT signing key (generate with `openssl rand -hex 32`)
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `TELEGRAM_WEBAPP_URL` - Your domain URL

### Required Frontend Variables
- `VITE_API_URL` - Backend API URL
- `VITE_TELEGRAM_BOT_USERNAME` - Bot username (no @)

See [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) for complete list.

## CI/CD Pipeline

### Workflows

1. **test.yml** - Runs on every push/PR
   - Frontend lint, type-check, test
   - Backend lint, type-check, test
   - Security scanning

2. **build.yml** - Runs on merge to main
   - Builds Docker images
   - Pushes to GitHub Container Registry
   - Scans for vulnerabilities

3. **deploy.yml** - Runs on release
   - Deploys to production server
   - Runs database migrations
   - Performs health checks

4. **migrate.yml** - Manual trigger
   - Database migration commands
   - Automatic backup before migration

### Required GitHub Secrets

See [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) for complete list.

## Monitoring

### Sentry (Error Tracking)
- Configure `SENTRY_DSN` in environment
- Errors automatically tracked in both frontend and backend

### Prometheus + Grafana
```bash
# Start monitoring stack
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana at http://localhost:3001
# Default credentials: admin/admin
```

### Health Checks
- Backend: `GET /api/v1/health`
- Frontend: `GET /health`

## Security

See [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) for:
- Pre-deployment security checks
- Security headers verification
- Incident response plan

## Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check if postgres is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

**Frontend not loading:**
```bash
# Check nginx logs
docker-compose logs frontend

# Verify build
cd frontend && npm run build
```

**API errors:**
```bash
# Check backend logs
docker-compose logs backend

# Test health endpoint
curl http://localhost:8000/api/v1/health
```

## Documentation

- [Environment Setup](docs/ENVIRONMENT_SETUP.md) - Detailed environment configuration
- [Deployment Guide](docs/DEPLOYMENT.md) - Complete deployment instructions
- [Security Checklist](docs/SECURITY_CHECKLIST.md) - Security requirements
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Pre-deployment checklist

## Support

For issues and questions:
- Create an issue in GitHub repository
- Check existing documentation in `docs/` folder
- Review logs with `docker-compose logs`

## License

[Your License Here]
