# Security Checklist

Security review checklist for current FitTracker Pro deployment.

## Transport and perimeter

- [ ] HTTPS is enforced (HTTP -> HTTPS redirect)
- [ ] TLS 1.2+ only, modern ciphers
- [ ] HSTS enabled
- [ ] Firewall exposes only required ports (22/80/443)
- [ ] Internal ports (PostgreSQL/Redis) are not public

## Auth and session security

- [ ] Telegram `init_data` hash validation enabled in backend
- [ ] Access/refresh JWT flow works with expiration checks
- [ ] `SECRET_KEY` is strong and rotated when needed
- [ ] Auth endpoints rate-limited (`RATE_LIMIT_PER_MINUTE` + proxy limits)

## Application hardening

- [ ] CORS is restricted (`ALLOWED_ORIGINS`, no wildcard in production)
- [ ] Input validation done with Pydantic schemas
- [ ] ORM/parameterized SQL used for DB operations
- [ ] No debug mode in production (`DEBUG=false`)
- [ ] Error responses do not leak stack traces/secrets

## Secrets and configuration

- [ ] No secrets in git history
- [ ] `.env` files are ignored by git
- [ ] GitHub Actions secrets are used for deployment
- [ ] File permissions for env/secrets are restricted

## Containers and dependencies

- [ ] Docker images are pulled from trusted sources
- [ ] CI Trivy scan passes (or accepted risks documented)
- [ ] Python and npm dependencies updated regularly
- [ ] High/critical dependency issues are fixed or mitigated

## Observability and response

- [ ] Sentry DSN configured (if used)
- [ ] Authentication and critical actions are logged
- [ ] Alerting exists for service downtime and repeated 5xx
- [ ] Backup + restore procedure is tested

## Telegram Mini App specifics

- [ ] BotFather Mini App URL matches production domain
- [ ] Production domain is HTTPS
- [ ] Bot token is server-side only
- [ ] Frontend never trusts Telegram user payload without backend verification

## Quick verification commands

```bash
curl -I https://your-domain.com
curl -f https://your-domain.com/api/v1/health
npm audit
pip-audit
```

## Review cadence

- [ ] Monthly dependency/security review
- [ ] Quarterly rollback and backup-restore drill
- [ ] Quarterly secrets rotation review
