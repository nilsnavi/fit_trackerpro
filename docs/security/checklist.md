# Чеклист безопасности FitTracker Pro

Практический список проверок для разработки, релиза и периодического аудита. Краткий англоязычный вариант см. в [`docs/SECURITY_CHECKLIST.md`](../SECURITY_CHECKLIST.md).

**Стек:** Telegram Mini App (Vite/React), FastAPI, PostgreSQL, Redis, Nginx, Docker/GHCR, GitHub Actions (в т.ч. [`security.yml`](../../.github/workflows/security.yml)).

---

## 1. Секреты и окружение

- [ ] В production заданы и **не совпадают** с dev-значениями из кода: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`, `SECRET_KEY` (см. [`backend/app/settings/config.py`](../../backend/app/settings/config.py)).
- [ ] `SECRET_KEY` — криптостойкая случайная строка (например 32+ байт в hex); ротация при компрометации или по регламенту.
- [ ] `ENVIRONMENT=production`, `DEBUG=false`; Swagger/OpenAPI в production недоступны без явной необходимости.
- [ ] `ALLOWED_ORIGINS` — явный список доменов Mini App и админки; **не** `*` в production (валидация на старте backend).
- [ ] Файлы `.env` не в git; секреты в CI — через GitHub Secrets (или аналог), не в логах workflow.
- [ ] Учётные данные БД и Redis не проброшены наружу; пароли не дефолтные на боевом сервере.

---

## 2. Периметр, TLS и Nginx

- [ ] Только **443** (и при необходимости **80** → редирект на HTTPS); SSH по политике команды; Postgres/Redis **не** слушают публичный интерфейс.
- [ ] TLS 1.2+, современные шифры; сертификаты валидны и обновляются (Let’s Encrypt / корпоративный PKI).
- [ ] Рекомендуется HSTS для публичного домена Mini App.
- [ ] Конфигурация [`nginx/nginx.conf`](../../nginx/nginx.conf) и пути к `ssl/` проверены после изменений.

---

## 3. Аутентификация Telegram и сессии

- [ ] Backend **проверяет** подпись Telegram `init_data` (хеш), а не доверяет полям пользователя с клиента ([`telegram_auth`](../../backend/app/infrastructure/telegram_auth.py)).
- [ ] `TELEGRAM_BOT_TOKEN` хранится только на сервере и в секретах CI; не попадает в фронтенд и не логируется.
- [ ] URL Mini App в BotFather совпадает с production (`TELEGRAM_WEBAPP_URL`, HTTPS).
- [ ] JWT: адекватный `ACCESS_TOKEN_EXPIRE_MINUTES`, алгоритм согласован с настройками; при компрометации `SECRET_KEY` — массовый logout/ротация по политике продукта.

---

## 4. API: злоупотребления, лимиты, данные

- [ ] Rate limiting включён и согласован с [`RATE_LIMIT_*`](../../backend/.env.example) (default / auth / system / write tiers); при необходимости — лимиты на уровне Nginx для чувствительных путей.
- [ ] Для чувствительных мутаций используется заголовок **Idempotency-Key** там, где это предусмотрено (тренировки, достижения, экспорт, emergency — см. `IDEMPOTENCY_*_TTL_SECONDS`).
- [ ] Лимиты аналитики (`ANALYTICS_*_HARD_LIMIT`) не обходятся произвольными query-параметрами без проверки на backend.
- [ ] Валидация входа через Pydantic-схемы; ошибки в production **не** отдают stack trace и внутренние детали.
- [ ] Доступ к данным пользователя только после успешной аутентификации; проверены новые эндпоинты на **object-level** доступ (чужие `user_id` / ресурсы).

---

## 5. Данные, бэкапы, приватность

- [ ] Резервное копирование БД по регламенту деплоя ([`docs/DEPLOYMENT.md`](../DEPLOYMENT.md), [`ROLLBACK_STRATEGY.md`](../ROLLBACK_STRATEGY.md)); тест восстановления периодически выполняется.
- [ ] Health-метрики и персональные данные — минимизация в логах; PII не в Sentry breadcrumbs без необходимости.
- [ ] Миграции не оставляют тестовые учётки или отладочные флаги в production.

---

## 6. Контейнеры, образы, зависимости

- [ ] Production использует **версионированные** теги образов (`IMAGE_TAG`), не `:latest` ([`README.md`](../../README.md)).
- [ ] Базовые образы Postgres/Redis в compose по возможности закреплены (digest), как в production-стратегии репозитория.
- [ ] CI: `pip-audit`, `npm audit`, Trivy FS, CodeQL, dependency-review на PR — зелёные или риски задокументированы ([`security.yml`](../../.github/workflows/security.yml)).
- [ ] Dependabot/обновления зависимостей регулярно просматриваются; критические CVE закрываются в приоритете.

---

## 7. Наблюдаемость и реагирование

- [ ] `SENTRY_DSN` (если используется) — без утечки секретов в событиях; доступ к проекту Sentry ограничен.
- [ ] Метрики/алерты (Prometheus/Grafana по [`README.md`](../../README.md)) покрывают 5xx и аномалии по auth.
- [ ] Понятен процесс эскалации при инциденте (кто ротует ключи, кто откатывает деплой).

---

## 8. Фронтенд и клиент Mini App

- [ ] `VITE_*` не содержит серверных секретов; API URL указывает на доверенный backend.
- [ ] Не хранить токены в `localStorage` дольше необходимого; учитывать модель угроз WebView Telegram.
- [ ] Заголовки безопасности и политика для статики согласованы с [`security_headers`](../../backend/app/middleware/security_headers.py) и Nginx (тесты: [`test_security_headers.py`](../../backend/app/tests/test_security_headers.py)).

---

## 9. Быстрые проверки после изменений

```bash
# Здоровье API (с хоста или через прокси)
curl -fsS https://<ваш-домен>/api/v1/system/health
curl -fsS https://<ваш-домен>/api/v1/system/version

# Зависимости локально (дублирует часть CI)
cd backend && pip-audit -r requirements/dev.txt
cd frontend && npm audit --audit-level=moderate
```

---

## 10. Периодичность

| Период | Действие |
|--------|----------|
| Каждый релиз | Секции 1–4, smoke из раздела 9 |
| Ежемесячно | Зависимости, просмотр отчётов CI/security, секреты в ротации |
| Ежеквартально | Бэкап/restore drill, пересмотр CORS и Telegram URL, права доступа к инфраструктуре |

---

*Последнее обновление структуры: март 2026. При смене контрактов API или env — синхронизируйте этот файл с [`docs/env-matrix.md`](../env-matrix.md) и [`docs/ENVIRONMENT_SETUP.md`](../ENVIRONMENT_SETUP.md).*
