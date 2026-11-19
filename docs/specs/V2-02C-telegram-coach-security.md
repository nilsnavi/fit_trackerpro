# V2-02C — Telegram + Coach server RBAC / client consent

Основа: merged PR #273, `apps/pwa-v2` is independent of legacy frontend.

## Backend-verified contracts

- `POST /api/v1/users/auth/telegram`: `{init_data}` raw, server checks HMAC, expiration and bot identity in `AuthService.authenticate_telegram`. Server currently returns both access and refresh tokens.
- `GET /api/v1/users/auth/me`: verified user profile for session.
- `GET /api/v1/coach/profile`: `require_coach_feature` and `require_coach` on server; profile includes `user_id`, `is_active`.
- `GET /api/v1/coach/subscription`: server role, subscription and entitlements.
- `GET /api/v1/coach/clients`: server scopes by coach identity, records have `client_id`, `status`, `permissions`. Never fetch client details without separate permission checks.

## Fail-closed rules

- Telegram login only via real `window.Telegram.WebApp.initData` (not `initDataUnsafe` nor mock query params). No raw initData in URL or logs.
- No browser token storage; Telegram and email use the same SessionManager. On logout and identity switch, clear Query cache and invalidate pending requests.
- Coach routes open only after backend confirms role, matching user ID, active profile, valid subscription payload. `is_admin` is NOT Coach role.
- Client list displays only safe relationship metadata; no name, medical details, monitoring, health readings or guessed client consents.
- Backend CoachClientPermissions is currently an empty strict DTO. ACTIVE link is not health-data consent. Monitoring remains blocked until server-level explicit grant/consent verification.
- Server feature flags and entitlements remain authoritative; client-side route gating is defense-in-depth only.

## Acceptance

- Unit tests: signed-in account identity mismatch, 403/404, inactive coach, revoked client, malformed responses, incomplete Telegram tokens.
- Chromium: anonymous Coach denied, email verified Athlete, Telegram unavailable outside runtime. Mock only for tests.
- Manual Telegram Mini App signed initData, expired initData, wrong bot token, real SMTP, consent revocation and production smoke before release.

## Non-goals

No backend migration, new role granting, health-data monitoring enablement, identity linking or production deployment in this PR.
