# Security

Этот документ — канонический чеклист безопасности FitTracker Pro (разработка → релиз → эксплуатация).

## Source of truth

- Политика env/секретов: `docs/env-matrix.md` и `docs/ENVIRONMENT_SETUP.md`
- Production деплой и откат: `docs/DEPLOYMENT.md` и `docs/ROLLBACK_STRATEGY.md`
- Заголовки безопасности: `backend/app/middleware/security_headers.py`
- Nginx/TLS: `nginx/nginx.conf`
- Telegram auth flow: `docs/product/telegram-setup.md`

## 1) Секреты и окружение

- [ ] `SECRET_KEY` криптостойкий (32+ байта) и не совпадает с dev-значениями
- [ ] `ENVIRONMENT=production`, `DEBUG=false`
- [ ] `ALLOWED_ORIGINS` — явный allowlist (в production не `*`)
- [ ] `.env` файлы не в git; секреты деплоя — только через GitHub Secrets
- [ ] `TELEGRAM_BOT_TOKEN` хранится только на сервере/в секретах CI и не попадает во фронтенд

Операционно:

```bash
# Проверить что в git нет секретов
git grep -nE "(SECRET_KEY|TELEGRAM_BOT_TOKEN|POSTGRES_PASSWORD|PRIVATE_KEY)" -- . ':(exclude).env*'

# Проверить, что production .env доступен только владельцу
stat -c "%a %n" .env
```

## 2) Периметр, TLS и Nginx

- [ ] Внешние порты: только 22/80/443 (80 → редирект на HTTPS)
- [ ] TLS 1.2+, современные шифры; сертификаты валидны и обновляются
- [ ] Postgres/Redis не публикуются наружу (только внутренняя сеть)
- [ ] Пути `~/fittracker-pro/nginx/ssl` и конфиг `nginx/nginx.conf` проверены после изменений

Операционно:

```bash
# Сертификат и срок действия
openssl x509 -in nginx/ssl/fullchain.pem -noout -subject -issuer -enddate

# Nginx-конфиг валиден
docker run --rm \
  -v "$PWD/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$PWD/nginx/ssl:/etc/nginx/ssl:ro" \
  nginx:alpine nginx -t
```

## 3) Аутентификация и сессии

- [ ] Telegram `init_data` валидируется на backend (HMAC + `auth_date`)
- [ ] JWT access/refresh работает корректно (expiry/refresh/logout)
- [ ] Auth endpoints ограничены rate limit (и при необходимости — прокси-лимиты на Nginx)

Операционно:

```bash
# Должны возвращаться security/rate-limit заголовки
curl -i https://<domain>/api/v1/system/health | grep -Ei "strict-transport|x-content-type|x-frame|rate(limit|-)"
```

## 4) Приложение и данные

- [ ] Валидация входа через Pydantic; ошибки в production без утечки stack trace/секретов
- [ ] Проверен object-level доступ (нельзя читать/менять чужие ресурсы)
- [ ] Критичные мутации идемпотентны там, где предусмотрено (`Idempotency-Key`)
- [ ] Бэкапы и политика restore понятны и протестированы (см. `docs/ROLLBACK_STRATEGY.md`)

Операционно:

```bash
# Быстрый sanity-check миграций и эталонных данных
docker compose -f docker-compose.prod.yml run --rm backend alembic current
docker compose -f docker-compose.prod.yml run --rm -e REFERENCE_DATA_DIR=/app/reference_data backend python3 -m app.cli.seed_reference_data apply --dry-run
```

## 5) Контейнеры и зависимости

- [ ] Production использует версионированные теги (`IMAGE_TAG`), не `:latest`
- [ ] CI security checks зелёные или риски документированы (`.github/workflows/security.yml`)
- [ ] Dependency audit выполняется регулярно (`pip-audit`, `npm audit`)
- [ ] `docker-compose.prod.yml` использует hardening:
  - `no-new-privileges:true`
  - `cap_drop: [ALL]` (и минимальные `cap_add` только при необходимости)
  - `read_only: true` для stateless сервисов, где это совместимо с runtime
  - `tmpfs` для временных директорий (`/tmp`, `/var/run`, `/var/cache/nginx`, `/app/logs`)
- [ ] Чувствительные bind mounts в production вынесены **вне репозитория**:
  - TLS (`NGINX_SSL_DIR`)
  - бэкапы (`BACKUPS_DIR`)

Рекомендованная периодичность:

- Ежедневно: smoke + health checks после каждого deploy
- Еженедельно: `pip-audit`, `npm audit`, ревизия секретов/доступов
- Ежемесячно: тест восстановления из backup по `docs/ROLLBACK_STRATEGY.md`

## Incident Runbook (минимум)

1. Изолировать: остановить проблемный rollout (не трогая базу без необходимости).
2. Оценить: собрать логи backend/nginx/postgres за интервал инцидента.
3. Смягчить: откатить приложение на последний стабильный `IMAGE_TAG`.
4. Восстановить: только при подтверждённой проблеме данных — restore из pre-deploy backup.
5. Зафиксировать: заполнить постмортем (причина, таймлайн, корректирующие действия, дедлайн).

## Быстрые проверки (после деплоя)

```bash
curl -f https://<domain>/api/v1/system/health
curl -f https://<domain>/api/v1/system/version
```
