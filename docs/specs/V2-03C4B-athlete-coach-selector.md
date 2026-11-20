# V2-03C.4B — Athlete active coach selector and first consent

Status: implementation draft on mainline branch; PR requires full CI and review.

## API
- Authenticated `GET /api/v1/client/coach-grants/available-coaches`.
- Server derives athlete ID from the authenticated principal.
- Return only active, non-ended, non-archived CoachClient links owned by the athlete; require active CoachProfile and COACH role.
- Minimal DTO: `coach_id`, `display_name`; no email, Telegram ID, health fields or other clients.
- Coach feature flag disabled: return an empty list.

## PWA
- Premium Athlete privacy page shows the athlete's own active coaches.
- No free-form coach ID entry.
- Athlete selects `training_summary.read` and/or `workout_history.read` independently.
- Each scope is a separate explicit POST using consent version `v2-03c-1`.
- Existing active scope is disabled; a second independent scope for the same coach remains available.
- Revoke/regrant flows from V2-03C.4A remain intact.

## Security
- The selector is discovery UX, not an authorization boundary. Grant POST revalidates active relationship, active coach profile, COACH role and feature flag.
- Consent grants do not include health metrics or glucose.
- All reads must independently enforce consent server-side; client visibility is never sufficient.
- Identity-scoped query keys; no token in query keys; API responses use no-store.

## Partial failure
- Selected scopes are posted sequentially. If one POST succeeds and a later POST fails, successful grant remains on server.
- UI reports partial operation failure and re-fetches grants so the athlete sees actual persisted state before retrying.

## Acceptance
- Unauthenticated request returns 401.
- Athlete cannot enumerate another athlete's linked coaches.
- Paused/archived/ended relationships are omitted and POST is rejected server-side.
- DTO excludes email and Telegram identifiers.
- UI supports mobile widths, keyboard selection and explicit consent per scope.
- No demo data, fabricated identity, health scope or manual coach ID.
- Backend integration, frontend unit/build, OpenAPI contract, migration, responsive Chromium, mobile and regression CI pass.
