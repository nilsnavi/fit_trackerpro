#!/bin/bash
# FitTracker Pro Deployment Script
# Run this on your production server

set -e

echo "🚀 Deploying FitTracker Pro..."

# Configuration
DOMAIN=${1:-"fittrackpro.ru"}
EMAIL=${2:-"admin@fittrackpro.ru"}

# Update system
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
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
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem

# Update nginx config with domain
echo "⚙️ Updating nginx configuration..."
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

# Pull and start containers from registry images
echo "🐳 Pulling and starting containers from registry..."
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Set up SSL renewal cron job
echo "⏰ Setting up SSL renewal cron job..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem $(pwd)/nginx/ssl/ && docker-compose -f $(pwd)/docker-compose.prod.yml restart nginx") | crontab -

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Your WebApp is available at: https://$DOMAIN"
echo "🤖 Telegram webhook: https://$DOMAIN/telegram/webhook"
echo ""
echo "📋 Useful commands:"
echo "   docker-compose -f docker-compose.prod.yml logs -f    # View logs"
echo "   docker-compose -f docker-compose.prod.yml restart    # Restart services"
echo "   docker-compose -f docker-compose.prod.yml down       # Stop services"
