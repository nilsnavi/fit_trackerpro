# Deployment Guide

Complete guide for deploying FitTracker Pro to production.

## Table of Contents

1. [Hosting Options](#hosting-options)
2. [VPS Deployment](#vps-deployment)
3. [Domain & SSL Setup](#domain--ssl-setup)
4. [Telegram Bot Configuration](#telegram-bot-configuration)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

## Hosting Options

### Recommended VPS Providers

| Provider | Specs | Price/Month | Best For |
|----------|-------|-------------|----------|
| **Hetzner** | 2 vCPU, 4GB RAM | ~$5 | Best value |
| **DigitalOcean** | 1 vCPU, 1GB RAM | ~$6 | Easy to use |
| **Linode** | 1 vCPU, 1GB RAM | ~$5 | Good support |
| **AWS Lightsail** | 1 vCPU, 1GB RAM | ~$5 | AWS ecosystem |

### Cloud Platforms (Easier Setup)

| Platform | Pros | Cons |
|----------|------|------|
| **Render** | Free tier, automatic deploys | Limited resources |
| **Railway** | Easy scaling, good DX | Can be expensive |
| **Fly.io** | Edge deployment, fast | Learning curve |
| **Heroku** | Very easy, managed | Expensive, sleeps on free |

### Minimum Server Requirements

- **CPU**: 1 vCPU
- **RAM**: 2GB (4GB recommended)
- **Storage**: 20GB SSD
- **OS**: Ubuntu 22.04 LTS
- **Network**: Public IP, ports 80/443 open

## VPS Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install other tools
sudo apt install -y git nginx certbot python3-certbot-nginx
```

### 2. Application Setup

```bash
# Create app directory
mkdir -p ~/fittracker-pro
cd ~/fittracker-pro

# Clone repository
git clone https://github.com/yourusername/fittracker-pro.git .

# Create backups directory
mkdir -p backups

# Create environment file
cat > .env << 'EOF'
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

# GitHub Container Registry
GITHUB_REPOSITORY=yourusername/fittracker-pro
EOF

# Set proper permissions
chmod 600 .env
```

### 3. GitHub Secrets Setup

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Your server IP address |
| `DEPLOY_USER` | SSH username (usually `root` or `ubuntu`) |
| `SSH_PRIVATE_KEY` | Private key for SSH access |
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `SECRET_KEY` | JWT secret key |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBAPP_URL` | Your domain URL |
| `ALLOWED_ORIGINS` | CORS allowed origins |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `VITE_API_URL` | API URL for frontend |
| `VITE_TELEGRAM_BOT_USERNAME` | Bot username |
| `SLACK_WEBHOOK_URL` | Slack notifications (optional) |

## Domain & SSL Setup

### 1. DNS Configuration

Point your domain to your server:

```
Type: A
Name: @
Value: YOUR_SERVER_IP
TTL: 3600
```

For www subdomain:
```
Type: A
Name: www
Value: YOUR_SERVER_IP
TTL: 3600
```

### 2. SSL Certificate with Let's Encrypt

```bash
# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Auto-renewal test
sudo certbot renew --dry-run
```

### 3. Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Upstream
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:80;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline';" always;

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 86400;
        }

        # Static files
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

Copy SSL certificates:

```bash
sudo mkdir -p ~/fittracker-pro/nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/fittracker-pro/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/fittracker-pro/nginx/ssl/
sudo chown -R $USER:$USER ~/fittracker-pro/nginx/ssl
```

## Telegram Bot Configuration

### 1. Create Bot with BotFather

1. Message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow prompts to set name and username
4. Save the token provided

### 2. Configure Mini App

1. Send `/mybots` to BotFather
2. Select your bot
3. Go to **Bot Settings**
4. Select **Menu Button**
5. Configure:
   - Button text: "Open App"
   - URL: `https://yourdomain.com`

### 3. Set Webhook (Optional)

If using bot webhooks instead of polling:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/v1/webhook"}'
```

### 4. Configure Domain

In BotFather:
1. `/mybots` → Select bot → **Bot Settings**
2. **Configure Mini App**
3. Add your domain to allowed domains

## Production Deployment

### Automated Deployment (Recommended)

1. Create a release on GitHub
2. The `deploy.yml` workflow will automatically deploy

### Manual Deployment

```bash
# SSH to server
ssh user@your-server-ip

# Navigate to project
cd ~/fittracker-pro

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Database Backup

```bash
# Manual backup
docker exec fittracker-postgres pg_dump -U fittracker fittracker > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker exec -i fittracker-postgres psql -U fittracker -d fittracker < backup_file.sql

# Automated daily backup (add to crontab)
0 2 * * * cd ~/fittracker-pro && docker exec fittracker-postgres pg_dump -U fittracker fittracker > backups/backup_$(date +\%Y\%m\%d).sql
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs <service-name>

# Check disk space
df -h

# Restart service
docker-compose -f docker-compose.prod.yml restart <service-name>
```

### Database Connection Issues

```bash
# Check if postgres is running
docker-compose -f docker-compose.prod.yml ps

# Check postgres logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker exec -it fittracker-postgres psql -U fittracker -d fittracker
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew

# Copy new certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem ~/fittracker-pro/nginx/ssl/

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Telegram WebApp Not Loading

- Check HTTPS is enabled (Telegram requires HTTPS)
- Verify domain is added to allowed domains in BotFather
- Check browser console for CORS errors
- Verify `TELEGRAM_WEBAPP_URL` matches your domain
