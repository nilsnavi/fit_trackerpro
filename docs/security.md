# Security

Этот документ — канонический чеклист безопасности FitTracker Pro (разработка → релиз → эксплуатация).

## Source of truth

- Политика env/секретов: `docs/env-matrix.md` и `docs/ENVIRONMENT_SETUP.md`
- Production деплой и откат: `docs/deployment.md` и `docs/ROLLBACK_STRATEGY.md`
- Заголовки безопасности: `backend/app/middleware/security_headers.py`
- Nginx/TLS: `nginx/nginx.conf`
- Telegram auth flow: `TELEGRAM_SETUP.md`

## 1) Секреты и окружение

- [ ] `SECRET_KEY` криптостойкий (32+ байта) и не совпадает с dev-значениями
- [ ] `ENVIRONMENT=production`, `DEBUG=false`
- [ ] `ALLOWED_ORIGINS` — явный allowlist (в production не `*`)
- [ ] `.env` файлы не в git; секреты деплоя — только через GitHub Secrets
- [ ] `TELEGRAM_BOT_TOKEN` хранится только на сервере/в секретах CI и не попадает во фронтенд

## 2) Периметр, TLS и Nginx

- [ ] Внешние порты: только 22/80/443 (80 → редирект на HTTPS)
- [ ] TLS 1.2+, современные шифры; сертификаты валидны и обновляются
- [ ] Postgres/Redis не публикуются наружу (только внутренняя сеть)
- [ ] Пути `~/fittracker-pro/nginx/ssl` и конфиг `nginx/nginx.conf` проверены после изменений

## 3) Аутентификация и сессии

- [ ] Telegram `init_data` валидируется на backend (HMAC + `auth_date`)
- [ ] JWT access/refresh работает корректно (expiry/refresh/logout)
- [ ] Auth endpoints ограничены rate limit (и при необходимости — прокси-лимиты на Nginx)

## 4) Приложение и данные

- [ ] Валидация входа через Pydantic; ошибки в production без утечки stack trace/секретов
- [ ] Проверен object-level доступ (нельзя читать/менять чужие ресурсы)
- [ ] Критичные мутации идемпотентны там, где предусмотрено (`Idempotency-Key`)
- [ ] Бэкапы и политика restore понятны и протестированы (см. `docs/ROLLBACK_STRATEGY.md`)

## 5) Контейнеры и зависимости

- [ ] Production использует версионированные теги (`IMAGE_TAG`), не `:latest`
- [ ] CI security checks зелёные или риски документированы (`.github/workflows/security.yml`)
- [ ] Dependency audit выполняется регулярно (`pip-audit`, `npm audit`)

## Быстрые проверки (после деплоя)

```bash
curl -f https://<domain>/api/v1/system/health
curl -f https://<domain>/api/v1/system/version
```

