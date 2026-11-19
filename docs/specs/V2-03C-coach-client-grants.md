# SPEC V2-03C — Разрешения Coach–Client (server authority)

Статус: **design / NOT IMPLEMENTED**. Этот документ не выдаёт никаких прав и не меняет поведение API. Применять миграции и включать health monitoring можно только после реализации, тестов и отдельного согласования.

## 1. Цель

Клиент самостоятельно и явно разрешает конкретному тренеру читать конкретную категорию своих данных. Роль COACH, действующая связь `coach_clients`, подписка или feature flag **не заменяют согласие**. По умолчанию любой доступ запрещён (deny-by-default). Учитываются отзыв и окончание связи.

## 2. Scope и запреты

- v1 scopes: `training_summary.read` (агрегированная тренировочная статистика), `workout_history.read` (история тренировок без медицинских полей), `health_metrics.read` (особая категория; **выключено до отдельной правовой/безопасностной проверки**).
- Никаких wildcard, `all`, массовых grants, выдачи прав тренером или неявного consent при принятии приглашения.
- Не использовать устаревший `GET /api/v1/users/coach-access`: текущий контракт возвращает 501.
- Старый `coach_clients.permissions = {}` не трактовать как новое согласие, не делать автоматическую миграцию в разрешения.
- Доступ на чтение данных клиента только через новый endpoint, а не через существующие `/users/me`, `/workouts/history` и `/health-metrics` (они остаются привязаны к текущему спортсмену).

## 3. Модель БД (новая таблица)

`coach_client_grants`:
- `id` PK UUID; `coach_id` FK users CASCADE; `client_id` FK users CASCADE; `relationship_id` FK coach_clients CASCADE
- `scope` VARCHAR(48) CHECK allowlisted
- `status` ENUM/string: `ACTIVE`, `REVOKED`, `EXPIRED`
- `consent_version` VARCHAR(32) NOT NULL
- `granted_at` timestamptz NOT NULL, `expires_at` timestamptz nullable, `revoked_at` timestamptz nullable
- `created_at`, `updated_at` timestamptz; actor_id only the client (identity from access token)
- `UNIQUE(relationship_id, scope)`: reinstate through explicit client action with audit trail; never silently resurrect revoked grants
- `CHECK(coach_id <> client_id)`, `CHECK(revoked_at IS NOT NULL IFF status = REVOKED)`
- indexes: `(coach_id, client_id, status)`, `(client_id, status)`
- audit events in immutable audit trail with action / actor ID / coach / client / scope / version / timestamp (no health values, no bearer tokens)

Migration AFTER `s11_2_email_auth` (verify Alembic head before coding). Online-safe, no defaults that grant access. Downgrade policy must reject destructive downgrade if grants exist.

## 4. API /api/v1 (proposed, not shipped)

### Client-owned
- `GET /client/coach-grants`: only grants of authenticated athlete, safe profile labels
- `POST /client/coach-grants`: `{coach_id, scope, consent_version, expires_at?}`; only for ACTIVE relationship. Idempotent when already ACTIVE with identical data; explicit opt-in required.
- `DELETE /client/coach-grants/{grant_id}`: immediate revocation, idempotent, log actor. Never allow grant update by COACH.

### Coach-owned
- `GET /coach/clients/{client_id}/training-summary`: requires COACH role, feature, ACTIVE relationship, ACTIVE `training_summary.read` grant, nonexpired consent, scoped DB lookup, audit. Response is explicitly allowlisted.
- `GET /coach/clients/{client_id}/workout-history`: same for `workout_history.read`; exclude glucose, wearable vitals, notes containing health data, profile fields and any unapproved metrics.
- Health reading endpoints remain **403 / disabled** until explicit controls, minimization and audit go through security review.

Return 401 unauthenticated; 403 if no role/no valid grant; 404 for no visible relationship, without disclosing existence of unrelated account; 409 when relationship is not ACTIVE or consent version is stale; 422 for unknown scope.

## 5. Авторизация и TOCTOU

Server dependency `require_active_grant(coach_id_from_auth, client_id_from_path, scope)` verifies in a single DB transaction:
1. Feature flag and role `COACH`, active Coach profile.
2. Coach-client relation matches both IDs and is `ACTIVE` (not PAUSED, REVOKED, ARCHIVED).
3. Grant for exact same `relationship_id + scope`, status ACTIVE, version accepted and not expired, revoked_at null.
4. Entitlement for requested capability (subscription alone is not a grant).
5. Read query includes client_id and scopes, does not accept arbitrary user IDs in raw client fetch.
6. On revoke: invalidate caches and reject subsequent reads; for concurrent requests transaction isolation and atomic checks must be demonstrated. Do not cache positive authorization decision across requests.

## 6. UX

Client sees coach name, granular scopes, purpose, version, expiry, exact actions “Разрешить” and “Отозвать”. Explicit opt-in checkbox/confirmation; no prechecked toggles. Coach sees “Нет доступа — попросите клиента дать согласие”, not empty or fabricated metrics. Revocation is visible instantly; no silent regrant. Separate onboarding/telegram privacy notices and consent log.

## 7. Required QA

- Default deny when no grant; ACTIVE relation without grant; subscription alone; admin role alone.
- Positive scoped owner A->Coach X; Coach Y cannot reuse; Client B cannot change A grant.
- Revocation, expiry, PAUSED/REVOKED relation, duplicate requests, concurrent revoke/read, stale consent version, absent feature flag, downgrade subscription.
- 401/403/404 negative responses do not reveal client existence or health fields.
- Login Email and Telegram, cross-account token switch, refresh/logout invalidate caches.
- DB migration up/down safely with Postgres; schemas and OpenAPI parity; audit contains no health details; full E2E, security scanning.
- No production rollout until explicit live staging acceptance including per-client revoke test.

## 8. Breakdown

- **V2-03C.1** DB model + Alembic migration + repository read checks + tests.
- **V2-03C.2** Client grant/revoke REST + audit and strict DTO + integration tests.
- **V2-03C.3** Coach allowlisted training reads + fail-closed authorization + cross-account tests.
- **V2-03C.4** PWA consent management UI + e2e + staging rollout checklist.

**Acceptance:** all granular access is denied before the user explicitly grants it and denied immediately after revoke, consistently across UI and API.
