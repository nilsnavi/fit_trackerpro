# V2-03C.4B — Athlete active coach selector and first consent

Status: implementation draft; depends on V2-03C.4A (#283).

## Scope
- Authenticated endpoint `GET /api/v1/client/coach-grants/available-coaches`.
- Return only active, non-ended, non-archived CoachClient links owned by current athlete, with active CoachProfile and COACH role.
- Minimal DTO: `coach_id`, `display_name`. No email, Telegram ID, health data, or other clients.
- PWA selector displays the athlete's own connected coaches; no free-form coach ID input.
- Athlete independently opts into `training_summary.read` and/or `workout_history.read`.
- Each selected scope is created with its own explicit POST and fixed consent version `v2-03c-1`.
- Already active scopes are disabled in the selector; other scopes for the same coach remain independently selectable.
- Existing revoke/regrant flow remains unchanged.

## Authorization and privacy
- The backend derives athlete identity from Bearer token; no client-supplied owner ID.
- Endpoint filters by current user's client_id and active relationship state.
- Grant service still revalidates relationship, CoachProfile, COACH role and feature flag at write time.
- Consent does not authorize health metrics or arbitrary profile fields.
- Coach reads remain governed by server-side consent checks in the dependent C.3 backend PRs; UI alone is not a security boundary.

## Failure semantics
- No coach links: empty state asks athlete to request invitation.
- Paused/archived/revoked link: omitted from available selector; create endpoint independently rejects.
- Existing active scope: disabled, not duplicated.
- Network/API failure: show error; never infer permission granted.
- Multi-scope selection is a sequence of independent POSTs. If a later POST fails, earlier successful scopes remain granted and are shown after refresh; user is told to inspect current state before retrying.

## Acceptance
- Auth required; unauthenticated request returns 401.
- Athlete A cannot enumerate coaches linked to athlete B.
- Only active valid coach relationship returned.
- DTO contains no email, Telegram ID or health fields.
- Paused relationship is not selectable and grant POST rejected.
- First grant requires explicit coach selection and per-scope checkbox.
- Every grant uses fixed version and exact scope.
- No manual coach ID, no demo records, no local optimistic grant state.
- Unit, API integration, responsive Chromium, mobile and regression CI pass.
