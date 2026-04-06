#!/bin/bash
# FitTracker Pro Deployment Script
# Run this on your production server

set -Eeuo pipefail

trap 'echo "❌ Deployment failed at line $LINENO"' ERR

echo "🚀 Deploying FitTracker Pro..."

# Configuration
DOMAIN=${1:-"fittrackpro.ru"}
EMAIL=${2:-"admin@fittrackpro.ru"}

COMPOSE_CMD="docker-compose"
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

# Update system
echo "📦 Updating system packages..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version >/dev/null 2>&1; then
        echo "🐳 Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
fi

# Install certbot for SSL
echo "🔒 Installing certbot for SSL..."
sudo apt-get install -y certbot

# Create SSL directory
mkdir -p nginx/ssl

# Get SSL certificate
echo "📜 Obtaining SSL certificate for $DOMAIN..."
sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email $EMAIL

# Copy certificates
echo "📋 Copying SSL certificates..."
sudo install -m 644 "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "nginx/ssl/fullchain.pem"
sudo install -m 600 "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "nginx/ssl/privkey.pem"

# Update nginx config with domain
echo "⚙️ Updating nginx configuration..."
cp nginx/nginx.conf nginx/nginx.conf.bak
sed -i "s/server_name _;/server_name $DOMAIN;/g" nginx/nginx.conf

# Create .env file if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp backend/.env.production.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your values:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - SECRET_KEY"
    echo "   - TELEGRAM_WEBAPP_URL=https://$DOMAIN"
    echo "   - ALLOWED_ORIGINS=https://$DOMAIN"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

chmod 600 .env

# Pull images and apply migrations before switching running containers (matches CI order)
echo "🐳 Pulling container images..."
$COMPOSE_CMD -f docker-compose.prod.yml pull

echo "📊 Running database migrations (before up -d)..."
$COMPOSE_CMD -f docker-compose.prod.yml run --rm backend alembic upgrade head

echo "🌱 Seeding reference data (idempotent)..."
$COMPOSE_CMD -f docker-compose.prod.yml run --rm \
  -e REFERENCE_DATA_DIR=/app/reference_data \
  backend python3 -m app.cli.seed_reference_data apply

echo "🐳 Starting / updating containers..."
$COMPOSE_CMD -f docker-compose.prod.yml up -d

# Set up SSL renewal cron job
echo "⏰ Setting up SSL renewal cron job..."
DEPLOY_DIR=$(pwd)
RENEW_CMD="certbot renew --quiet && install -m 644 /etc/letsencrypt/live/$DOMAIN/fullchain.pem $DEPLOY_DIR/nginx/ssl/fullchain.pem && install -m 600 /etc/letsencrypt/live/$DOMAIN/privkey.pem $DEPLOY_DIR/nginx/ssl/privkey.pem && cd $DEPLOY_DIR && $COMPOSE_CMD -f docker-compose.prod.yml restart nginx"
(crontab -l 2>/dev/null | grep -v 'fittracker-renew'; echo "0 3 * * * $RENEW_CMD # fittracker-renew") | crontab -

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Your WebApp is available at: https://$DOMAIN"
echo "🤖 Telegram webhook: https://$DOMAIN/telegram/webhook"
echo ""
echo "📋 Useful commands:"
echo "   $COMPOSE_CMD -f docker-compose.prod.yml logs -f    # View logs"
echo "   $COMPOSE_CMD -f docker-compose.prod.yml restart    # Restart services"
echo "   $COMPOSE_CMD -f docker-compose.prod.yml down       # Stop services"
