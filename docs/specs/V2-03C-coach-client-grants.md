# SPEC V2-03C — Разрешения Coach–Client (server authority)

Статус на **19.11.2026**: **частично реализовано**. V2-03C.1 объединён с `main` через [PR #278](https://github.com/nilsnavi/fit_trackerpro/pull/278); V2-03C.2 объединён с `main` через [PR #279](https://github.com/nilsnavi/fit_trackerpro/pull/279). V2-03C.3 реализуется в зависимых Draft PR [#280](https://github.com/nilsnavi/fit_trackerpro/pull/280), [#281](https://github.com/nilsnavi/fit_trackerpro/pull/281) и [#282](https://github.com/nilsnavi/fit_trackerpro/pull/282); V2-03C.4 не реализован. Эта спецификация не выдаёт никаких прав сама по себе и не разрешает включать health monitoring.

## 1. Цель

Клиент самостоятельно и явно разрешает конкретному тренеру читать конкретную категорию своих данных. Роль COACH, действующая связь `coach_clients`, подписка или feature flag **не заменяют согласие**. По умолчанию любой доступ запрещён (deny-by-default). Учитываются отзыв и окончание связи.

## 2. Scope и запреты

- Разрешённые в C.1 scopes: `training_summary.read` (агрегированная тренировочная статистика) и `workout_history.read` (история тренировок без медицинских полей). `health_metrics.read` **не входит в allowlist и запрещён ограничением БД**; для него понадобится отдельная спецификация, правовая и security-проверка.
- Никаких wildcard, `all`, массовых grants, выдачи прав тренером или неявного consent при принятии приглашения.
- Не использовать устаревший `GET /api/v1/users/coach-access`: текущий контракт возвращает 501.
- Старый `coach_clients.permissions = {}` не трактовать как новое согласие, не делать автоматическую миграцию в разрешения.
- Доступ на чтение данных клиента только через новый endpoint, а не через существующие `/users/me`, `/workouts/history` и `/health-metrics` (они остаются привязаны к текущему спортсмену).

## 3. Модель БД (новая таблица)

`coach_client_grants` — **реализовано в PR #278 / C.1**:
- `id` PK UUID; `coach_id` FK users CASCADE; `client_id` FK users CASCADE; `relationship_id` FK coach_clients CASCADE
- `scope` VARCHAR(48) CHECK allowlisted
- `status` ENUM/string: `ACTIVE`, `REVOKED`, `EXPIRED`
- `consent_version` VARCHAR(32) NOT NULL
- `granted_at` timestamptz NOT NULL, `expires_at` timestamptz nullable, `revoked_at` timestamptz nullable
- `created_at`, `updated_at` timestamptz; actor_id only the client (identity from access token)
- `UNIQUE(relationship_id, scope)`: reinstate through explicit client action with audit trail; never silently resurrect revoked grants
- `CHECK(coach_id <> client_id)`, `CHECK(revoked_at IS NOT NULL IFF status = REVOKED)`
- indexes: `(coach_id, client_id, status)`, `(client_id, status)`
- Таблица журнала `coach_grant_audit` и транзакционные записи `GRANTED`/`REVOKED` объединены в **PR #279 / C.2**. Иммутабельность на уровне БД (запрет UPDATE/DELETE) пока **не подтверждена** и остаётся отдельным security-gate; журнал не должен содержать значения здоровья или bearer-токены.

В `main` миграция `s11_3_coach_client_grants` следует за `s11_2_email_auth`: она добавляет пустую таблицу без автоматически выданных разрешений; downgrade отказывается удалять непустые grants. В `main` добавлена миграция `s11_4_coach_grant_audit` через PR #279. Перед выпуском требуются проверки миграций на PostgreSQL и процедуры сохранности аудита.

## 4. API /api/v1 (статус по этапам)

### Client-owned — реализовано и объединено с `main` через PR #279
- `GET /client/coach-grants`: собственные гранты аутентифицированного спортсмена; отображаемое имя тренера не входит в текущую DTO `GrantView` и остаётся задачей UI/API.
- `POST /client/coach-grants`: `{coach_id, scope, consent_version, expires_at?}`; только при ACTIVE-связи, с явным согласием клиента. Повтор идентичного активного гранта идемпотентен; изменение гранта требует отдельного отзыва и повторной явной выдачи.
- `DELETE /client/coach-grants/{grant_id}`: отзыв только владельцем, повторный отзыв идемпотентен, запись аудита `REVOKED` в той же транзакции.
- Повторная выдача REVOKED-гранта через отдельный POST клиента с новым `GRANTED` audit event реализована в #279. Проверки гонок чтения/отзыва и приёмка на staging остаются отдельными требованиями.

### Coach-owned — запланировано в C.3, **не реализовано**
- `GET /coach/clients/{client_id}/training-summary`: requires COACH role, feature, ACTIVE relationship, ACTIVE `training_summary.read` grant, nonexpired consent, scoped DB lookup, audit. Response is explicitly allowlisted.
- `GET /coach/clients/{client_id}/workout-history`: same for `workout_history.read`; exclude glucose, wearable vitals, notes containing health data, profile fields and any unapproved metrics.
- Health reading endpoints remain **403 / disabled** until explicit controls, minimization and audit go through security review.

Return 401 unauthenticated; 403 if no role/no valid grant; 404 for no visible relationship, without disclosing existence of unrelated account; 409 when relationship is not ACTIVE or consent version is stale; 422 for unknown scope.

## 5. Авторизация и TOCTOU

В C.1 реализован **read-only** `CoachGrantRepository.is_allowed()`, который проверяет флаг Coach, роль, активный профиль, точную ACTIVE-связь, scope, версию, отсутствие отзыва и истечение срока без кеша положительного решения. Полноценный dependency `require_active_grant(...)` для конечных Coach-owned endpoints пока **не реализован**. В C.3 он должен обеспечивать следующую проверку непосредственно при чтении данных:
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

- **V2-03C.1 — MERGED**: БД, ORM-модель, `s11_3_coach_client_grants`, read-only fail-closed repository и тесты. [PR #278](https://github.com/nilsnavi/fit_trackerpro/pull/278).
- **V2-03C.2 — MERGED**: клиентские GET/POST/DELETE, строгие DTO, транзакционный аудит `coach_grant_audit`, миграция `s11_4_coach_grant_audit`, интеграционные тесты. [PR #279](https://github.com/nilsnavi/fit_trackerpro/pull/279). DB-enforced immutable audit остаётся отдельным security-gate.
- **V2-03C.3 — IN PROGRESS / DRAFT**: [PR #280](https://github.com/nilsnavi/fit_trackerpro/pull/280) закрывает доступ к существующему Coach Monitoring без `training_summary.read`; [PR #281](https://github.com/nilsnavi/fit_trackerpro/pull/281) добавляет аудит успешного чтения; [PR #282](https://github.com/nilsnavi/fit_trackerpro/pull/282) добавляет минимизированные Coach training-summary/workout-history и блокировку связи. Все требуют финального CI, полноценного E2E, проверки read/revoke race на PostgreSQL и поэтапного merge.
- **V2-03C.4 — TODO**: кабинет управления согласиями PWA, явные подтверждения, revocation E2E, staging rollout checklist.

**Acceptance:** all granular access is denied before the user explicitly grants it and denied immediately after revoke, consistently across UI and API.
