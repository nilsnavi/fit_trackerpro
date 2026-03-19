# Production Deployment Checklist

Complete checklist for deploying FitTracker Pro to production.

## Pre-Deployment

### Code & Repository
- [ ] All tests passing (`npm test`, `pytest`)
- [ ] Code coverage >= 80%
- [ ] No security vulnerabilities (`npm audit`, `pip-audit`)
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Version bumped in `package.json` and tags

### Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `SECRET_KEY` generated (64+ chars)
- [ ] `TELEGRAM_BOT_TOKEN` obtained from @BotFather
- [ ] `TELEGRAM_WEBAPP_URL` set to production domain
- [ ] `ALLOWED_ORIGINS` includes production domain
- [ ] Database credentials secured
- [ ] Sentry DSN configured
- [ ] Environment variables in GitHub Secrets

### Infrastructure Setup
- [ ] VPS/cloud instance provisioned
- [ ] Domain purchased and DNS configured
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Server firewall configured (UFW/iptables)
- [ ] SSH key authentication only
- [ ] Docker and Docker Compose installed
- [ ] GitHub repository secrets configured

## Deployment

### Initial Setup
```bash
# 1. SSH to server
ssh user@your-server-ip

# 2. Clone repository
git clone https://github.com/yourusername/fittracker-pro.git
cd fittracker-pro

# 3. Create environment file
cp .env.example .env
# Edit .env with production values

# 4. Create required directories
mkdir -p backups nginx/ssl

# 5. Copy SSL certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl

# 6. Start services
docker-compose -f docker-compose.prod.yml up -d

# 7. Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 8. Verify health
curl https://yourdomain.com/api/v1/health
```

### Verification Steps

#### 1. Health Checks
- [ ] Backend health endpoint returns 200
- [ ] Frontend loads without errors
- [ ] Database connection successful
- [ ] Redis connection successful

#### 2. API Testing
```bash
# Test health endpoint
curl -f https://yourdomain.com/api/v1/health

# Test CORS
curl -H "Origin: https://yourdomain.com" \
     -I https://yourdomain.com/api/v1/health

# Test authentication (if applicable)
curl -X POST https://yourdomain.com/api/v1/auth/telegram \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
```

#### 3. Telegram Integration
- [ ] Bot responds to /start command
- [ ] Mini App opens from bot menu
- [ ] WebApp loads without errors
- [ ] Authentication works in WebApp

#### 4. SSL/TLS Verification
```bash
# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Verify SSL Labs rating (should be A+)
# Visit: https://www.ssllabs.com/ssltest/
```

#### 5. Security Headers Check
```bash
curl -I https://yourdomain.com | grep -E "(Strict-Transport|X-Frame|X-Content|X-XSS|Referrer|Content-Security)"
```

Expected headers:
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Content-Security-Policy`

## Post-Deployment

### Monitoring Setup
- [ ] Sentry project created and DSN configured
- [ ] Prometheus + Grafana deployed
- [ ] Log aggregation configured
- [ ] Uptime monitoring (UptimeRobot/Pingdom)
- [ ] Alerting rules configured

### Backup Configuration
- [ ] Database backup script created
- [ ] Automated daily backups scheduled (cron)
- [ ] Backup storage configured (S3/remote)
- [ ] Backup restoration tested

### Documentation
- [ ] Runbook created for common issues
- [ ] Rollback procedure documented
- [ ] Contact list updated
- [ ] Access credentials stored securely

## Final Verification

### Functional Testing
- [ ] User registration works
- [ ] User login works
- [ ] Workout creation works
- [ ] Exercise logging works
- [ ] Analytics display works
- [ ] Achievements system works

### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Database queries optimized
- [ ] Static assets cached

### Load Testing (Optional)
```bash
# Using Apache Bench
ab -n 1000 -c 10 https://yourdomain.com/api/v1/health

# Using k6 (recommended)
k6 run --vus 100 --duration 5m load-test.js
```

## GitHub Actions Secrets Checklist

Ensure these secrets are configured:

| Secret | Purpose |
|--------|---------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `SSH_PRIVATE_KEY` | SSH private key for deployment |
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `SECRET_KEY` | JWT secret key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_WEBAPP_URL` | Production URL |
| `ALLOWED_ORIGINS` | CORS allowed origins |
| `SENTRY_DSN` | Sentry error tracking |
| `VITE_API_URL` | API URL for frontend |
| `VITE_TELEGRAM_BOT_USERNAME` | Bot username |
| `SLACK_WEBHOOK_URL` | Deployment notifications |

## Rollback Procedure

If deployment fails:

```bash
# 1. SSH to server
ssh user@your-server-ip
cd ~/fittracker-pro

# 2. Stop services
docker-compose -f docker-compose.prod.yml down

# 3. Restore database (if needed)
LATEST_BACKUP=$(ls -t backups/*.sql | head -1)
docker exec -i fittracker-postgres psql -U fittracker -d fittracker < "$LATEST_BACKUP"

# 4. Checkout previous version
git log --oneline -5  # Find previous commit
git checkout <previous-commit>

# 5. Restart services
docker-compose -f docker-compose.prod.yml up -d

# 6. Verify rollback
curl https://yourdomain.com/api/v1/health
```

## Maintenance Schedule

| Task | Frequency | Command/Action |
|------|-----------|----------------|
| Update dependencies | Weekly | `npm update`, `pip list --outdated` |
| Security updates | As needed | Monitor GitHub Security tab |
| Database backup | Daily | Automated via cron |
| Log rotation | Weekly | `logrotate` configuration |
| SSL renewal | Auto (90 days) | `certbot renew` |
| Health check | Continuous | Uptime monitoring |
| Performance review | Monthly | Grafana dashboards |
| Security audit | Quarterly | Review checklist |
| Disaster recovery test | Quarterly | Restore from backup |

## Emergency Contacts

- **Primary**: [Name] - [Email] - [Phone]
- **Secondary**: [Name] - [Email] - [Phone]
- **Hosting Provider**: [Support URL/Phone]
- **Domain Registrar**: [Support URL/Phone]

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| DevOps Engineer | | | |
| Security Reviewer | | | |
| Product Owner | | | |

---

**Deployment Date**: _______________
**Version Deployed**: _______________
**Deployed By**: _______________
