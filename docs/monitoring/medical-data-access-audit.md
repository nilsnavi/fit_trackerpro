# Аудит доступа к медицинским данным и алерты

Документ покрывает пункт #190 (WS3-8): пост-фактум расследование доступа к
медданным и алерты на аномалии.

## Что аудируется

Чтение чувствительных данных здоровья пишет событие в лог `app.audit`
(`event=audit`, JSON через `JsonFormatter`):

- **Эндпоинты** (`backend/app/api/v1/health_metrics.py`):
  - `GET /api/v1/health-metrics/body-measurements`
  - `GET /api/v1/health-metrics/glucose`, `GET /api/v1/health-metrics/glucose/{id}`, `GET /api/v1/health-metrics/glucose/stats`
  - `GET /api/v1/health-metrics/wellness`, `GET /api/v1/health-metrics/wellness/{id}`, `GET /api/v1/health-metrics/wellness/stats`
  - `GET /api/v1/health-metrics/stats`
- **Событие:** `action="health.data_read"`, `user_db_id`, `telegram_id`,
  `client_ip`, `meta={"resource": "...", "operation": "read"}`.
- **Значения не логируются** — только факт доступа, ресурс и субъект.

Код: `_audit_health_read()` + константа `HEALTH_DATA_READ` в `backend/app/core/audit.py`.

## Пайплайн логов

`app.audit` (stdout JSON) → Docker logs → **Promtail** (`monitoring/promtail-config.yml`)
→ **Loki** (`monitoring/loki-config.yml`) → **Grafana** (`monitoring/grafana/`).

## Расследование (LogQL, Grafana → Explore → Loki)

Все события доступа конкретного пользователя за окно:

```logql
{job="fittracker-backend"} | json | action="health.data_read" | user_db_id="123"
```

Кто читал глюкозу за период (подозрительная активность / чужой IP):

```logql
{job="fittracker-backend"} | json
  | action="health.data_read" | meta_resource="glucose"
  | line_format "{{.timestamp}} uid={{.user_db_id}} ip={{.client_ip}}"
```

Всплеск доступа по IP (потенциальная утечка сессии):

```logql
sum by (client_ip) (count_over_time({job="fittracker-backend"} | json | action="health.data_read" [15m]))
```

> Имена полей `json`-парсера зависят от `JsonFormatter`; при вложенном `meta`
> используйте `meta_resource` (Loki flatten) или `| json meta` + `meta.resource`.

## Процедура

1. Зафиксировать инцидент (время, `telegram_id`, IP, ресурс).
2. Выгрузить `health.data_read` по субъекту и окну из Loki (запросы выше).
3. Сверить с `auth.*`-событиями (`auth.telegram_login`, `auth.refresh`,
   `auth.logout`) — не было ли доступа с чужого IP/устройства.
4. Проверить, не скомпрометированы ли refresh-сессии: при подозрении — logout-all
   (отзыв refresh) и ротация Telegram initData-сессии.
5. Ограничить доступ к Loki (только ops/security), сохранить выгрузку как evidence.
6. Отчёт: субъект, окно, ресурсы, IP, решение; при утечке — уведомить пользователя.

**Retention:** задаётся в `monitoring/loki-config.yml`; аудит-логи должны храниться
не меньше срока, требуемого политикой (`docs/legal/privacy-and-data.md`).

## Алерты (`monitoring/alerts.yml`)

- `HighAuthRejectionSpike` — доля 4xx (401/403) на `/api/v1/users/auth/*` > 20% за 5 мин
  (по `http_requests_total{handler=~"/api/v1/users/auth/.*",status="4xx"}`).
- `EmergencyDeliveryFailures` — `increase(emergency_delivery_failures_total[10m]) > 0`
  (счётчик инкрементится в `EmergencyService._deliver` при `unlinked`/`delivery_error`).
- `HighErrorRate`, `InstanceDown`, `DatabaseConnectionFailed` — уже были.

**Ограничение:** алерт по доле ошибок offline-очереди (`workoutSyncTelemetry`) пока
невозможен — событие эмитится только на клиенте, серверного приёмника нет. Нужен
эндпоинт-приёмник телеметрии (отдельная задача), после чего добавить правило.

## Включение метрик

Полные метрики (для алертов): `ENABLE_PROMETHEUS_METRICS=true` (прод).
При `false` экспортируется минимальный `http_requests_total`, но кастомный
`emergency_delivery_failures_total` не публикуется — в проде держите `true`.