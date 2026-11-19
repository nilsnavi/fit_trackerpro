# V2-03B — реальный кабинет тренера

Источник: FastAPI `GET /api/v1/coach/profile`, `/subscription`, `/clients`. Данные запрашиваются по очереди, только после подтверждения роли, пользователя и подписки.

## Достоверные показатели
- display_name тренера только из защищённого профиля Coach.
- plan, status, trial_days_remaining, grace_days_remaining, quota(active_programs) — из subscription.
- Active links — из /clients с фильтрацией ACTIVE. Это НЕ показатель оплаченных услуг и НЕ число разрешений на health data. Quota active_clients.used может включать PAUSED, поэтому показывается отдельный счётчик фактических ACTIVE-связей.
- Нет вымышленной выручки, активности клиентов, нагрузок, расписания и медицинского мониторинга.

## Безопасность
- Server role + feature flag remain authoritative; `is_admin` не даёт Coach роль.
- Проверка user_id профиля vs /users/auth/me; отказ от списка клиентов при 401/403/404 и неправильном ответе подписки.
- Доступ к здоровью не выдаётся даже при features.client_monitoring=true: требуется индивидуальный grant, запланированный на V2-03C.
- Query scoped to session identity and access token, logout clears cache; no storage of tokens.
- Fail-closed при невалидных DTO, статусах подписки без подписки и отсутствии данных. Empty ≠ loading ≠ error.

## Acceptance
- Unit: quotas, wrong identity, denied role, denied subscription, revoked/paused clients and sensitive-data allowlist.
- Chromium: confirmed Coach displays real mocked API payload, role denial prevents /clients; responsive view.
- GitHub CI TypeScript, eslint, unit, build, security, regression.
- Real staging API, signed Telegram flow and client consent revocation remain gates for commercial rollout.
