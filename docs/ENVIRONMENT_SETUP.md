# Environment Setup Guide

This guide explains how to configure environment variables for FitTracker Pro.

## Quick Start

1. Copy example files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Generate a secure secret key:
```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows (PowerShell):
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```

3. Update the variables in both `.env` files

## Backend Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async connection | `postgresql+asyncpg://user:pass@localhost/db` |
| `DATABASE_URL_SYNC` | PostgreSQL sync connection | `postgresql://user:pass@localhost/db` |
| `SECRET_KEY` | JWT signing key (32+ chars) | `a1b2c3d4...` |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_WEBAPP_URL` | Your Mini App URL | `https://fit.example.com` |

### Database Setup

**Local Development:**
```bash
# Using Docker
docker run -d \
  --name fittracker-db \
  -e POSTGRES_USER=fittracker \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=fittracker \
  -p 5432:5432 \
  postgres:15-alpine
```

**Production:**
Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)

### Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create new bot: `/newbot`
3. Set bot name and username
4. Copy the token to `TELEGRAM_BOT_TOKEN`
5. Set up Mini App:
   - `/mybots` → Select your bot → Bot Settings
   - Menu Button → Configure menu button
   - Set URL to your deployed app

## Frontend Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://api.fit.example.com/api/v1` |
| `VITE_TELEGRAM_BOT_USERNAME` | Bot username (no @) | `myfittrackerbot` |

### Environment-Specific Settings

**Development:**
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_ENVIRONMENT=development
VITE_ENABLE_DEBUG_TOOLS=true
```

**Production:**
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_ENVIRONMENT=production
VITE_ENABLE_DEBUG_TOOLS=false
VITE_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
```

## Production Environment Variables

Create `.env` in project root for Docker Compose:

```env
# Database
POSTGRES_USER=fittracker
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=fittracker

# Backend
SECRET_KEY=your_64_char_hex_key_here
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBAPP_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
SENTRY_DSN=your_sentry_dsn

# Frontend
VITE_API_URL=https://yourdomain.com/api/v1
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

## Security Checklist

- [ ] Changed default `SECRET_KEY` (min 32 chars)
- [ ] Used strong database password
- [ ] Set `DEBUG=false` in production
- [ ] Configured `ALLOWED_ORIGINS` correctly
- [ ] Protected `.env` files (never commit to git)
- [ ] Enabled Sentry for error tracking
- [ ] Set up SSL certificates

## Troubleshooting

### Database Connection Failed
```
Error: connection to server at "localhost" failed
```
- Check if PostgreSQL is running
- Verify credentials in DATABASE_URL
- Ensure database exists

### Telegram WebApp Not Loading
- Verify `TELEGRAM_WEBAPP_URL` matches your domain
- Check CORS settings in backend
- Ensure HTTPS is used (required by Telegram)

### CORS Errors
- Add your domain to `ALLOWED_ORIGINS`
- Include protocol (http:// or https://)
- Separate multiple origins with commas
