# Testing Gaps — Critical User Flows

This document maps **critical user flows** to the current test coverage and proposes **concrete tests** to close the most important gaps across frontend and backend.

## Legend

- **BE**: backend (FastAPI, `pytest`)
- **FE**: frontend (React, `jest` + Testing Library)
- **E2E**: end-to-end (not currently set up in this repo)
- **Status**: ✅ covered / 🟨 partial / ❌ missing

## Coverage map (flows → code → gaps → proposed tests)

| Critical flow | BE endpoints | FE pages/components/hooks | Current tests | Gap (risk) | Proposed tests (concrete) |
|---|---|---|---|---|---|
| **Auth (Telegram initData) → access app** | `POST /api/v1/users/auth/telegram`, `GET /api/v1/users/me` | `TelegramProvider`, `useTelegramWebApp`, any auth gate/route protection | ✅ `backend/app/tests/test_auth.py` happy-path + invalid cases | 🟨 No refresh/logout real scenarios; FE has no route/auth tests | **BE**: add refresh/logout integration tests (valid refresh token, invalid/expired refresh, logout invalidates). **FE**: route guard test: 401 leads to login/fallback; Telegram context init smoke. |
| **Token refresh / logout** | `POST /api/v1/users/auth/refresh`, `POST /api/v1/users/auth/logout` | (future) auth UI; global API client handling | 🟨 `test_auth.py` only validates missing body / unauth logout | ❌ No real refresh flow coverage; token invalidation not asserted | **BE**: `test_auth_refresh_happy_path`, `test_auth_refresh_invalid_token`, `test_logout_then_access_denied` (if blacklist/rotation exists). |
| **Workouts: list history** | `GET /api/v1/workouts/history`, `GET /api/v1/workouts/history/{workout_id}` | `features/workouts/pages/WorkoutsPage.tsx`, `WorkoutDetailPage.tsx`, history hooks | ❌ none | ❌ Core product flow untested; pagination/date filters/ownership | **BE**: tests for pagination + `date_from/date_to`, ownership (user A cannot read user B). **FE**: WorkoutsPage loading/error/empty states; click navigates to detail. |
| **Templates: create/update/delete/list** | `GET/POST /api/v1/workouts/templates`, `GET/PUT/DELETE /templates/{id}` | `WorkoutBuilder.tsx` (save template), templates list on `WorkoutsPage.tsx` | ❌ none | ❌ Template CRUD & ownership untested; likely regressions | **BE**: template CRUD integration tests (201/200/204); filter `template_type`; ownership isolation. **FE**: builder validation tests (name required, blocks required), mutation success resets draft & closes modal. |
| **Start workout from template** | `POST /api/v1/workouts/start` | `WorkoutsPage.tsx` “Start from template”, `WorkoutModePage.tsx` (if used) | ❌ none | ❌ Start path untested; navigation + returned workout contract | **BE**: `start` with valid template creates draft workout; invalid template → 404. **FE**: clicking start calls mutation and navigates to `/workouts/:id`. |
| **Active workout editing (optimistic) → complete** | `POST /api/v1/workouts/complete?workout_id=...` (with `Idempotency-Key`) | `WorkoutDetailPage.tsx`, `useOptimisticWorkoutSession`, local draft store | ❌ none | ❌ Highest-risk flow: data loss, double-submit, validation mismatches | **BE**: complete happy-path; validation errors; **idempotency** same key doesn’t double-apply; unauthorized → 401. **FE**: validations (duration range, at least one completed set), optimistic updates on “Mark”, error message rendering on mutation failure. |
| **Offline draft sync (Telegram Cloud Storage)** | (none directly; cloud storage client) | `useWorkoutSessionDraftCloudSync.ts` | ❌ none (only SyncQueueEngine unit tests) | ❌ Draft merge logic can silently corrupt/lose data | **FE (unit)**: cloud newer overwrites local; local newer pushes to cloud; `pagehide/visibilitychange` flush triggers `setItem/removeItem`. |
| **Exercises: browse/search/filter** | `GET /api/v1/exercises` + list endpoints | `features/exercises/pages/Catalog.tsx` | ❌ none | ❌ Discoverability and filters can break unnoticed | **BE**: filter validation, search length, pagination. **FE**: search input updates query and renders results/empty/error states. |
| **Exercises: create (user) + admin moderation** | `POST /api/v1/exercises`, `PUT/DELETE /exercises/{id}`, `POST /{id}/approve` | `AddExercise.tsx` | ❌ none | ❌ Role separation (`require_admin`) not tested | **BE**: non-admin update/approve → 403; admin path → 200; create exercise → 201. **FE**: create form validation + submit error handling. |
| **Analytics: summary/progress/calendar/export/recovery** | `/api/v1/analytics/*` | `features/analytics/pages/Analytics.tsx`, widgets (1RM, charts) | ❌ none | ❌ Breaks in analytics won’t be caught; query param validation untested | **BE**: period validation (422), hard limits (`max_exercises`, `max_data_points`), export idempotency + status. **FE**: page renders loading/data/error for summary/progress/calendar. |
| **Achievements: list/user/claim + idempotency** | `/api/v1/analytics/achievements/*` | `features/achievements/components/Achievements.tsx`, `useAchievements.ts` | ❌ none | ❌ Rewards/claim can double-apply without idempotency tests | **BE**: claim with same `Idempotency-Key` is safe; unauthorized → 401. **FE**: claim button states + optimistic UI (if any). |
| **Challenges: list/detail/join/leave/leaderboard** | `/api/v1/analytics/challenges/*` | (challenge UI if present) | ❌ none | ❌ Social flow untested; join code / privacy rules regress easily | **BE**: join/leave happy-path; join private without code returns correct error; leaderboard contract + limit validation. |
| **Emergency: contacts + notify workflow** | `/api/v1/system/emergency/*` | `features/emergency/components/EmergencyMode.tsx` | ❌ none | ❌ Safety flow untested; idempotency and validation are critical | **BE**: contacts CRUD; notify workout start/end with idempotency; invalid workout_id errors. **FE**: basic UI state and error handling. |
| **Health metrics security boundary** | `/api/v1/system/health` (public) vs `/api/v1/health-metrics/*` (protected) | `features/health/pages/HealthPage.tsx` | ✅ partial: `test_health.py` checks `/health-metrics/stats` requires 401 | 🟨 Only one endpoint checked; FE not covered | **BE**: add coverage for other health-metrics endpoints; role/auth matrix. **FE**: HealthPage shows auth error state when backend returns 401/403. |

## Concrete test file suggestions (where to place)

### Backend (pytest)

- `backend/app/tests/test_workouts.py`
  - templates CRUD + ownership
  - start workout from template
  - complete workout validation + idempotency
  - history pagination + date filters + ownership
- `backend/app/tests/test_exercises.py`
  - list filters + create
  - admin-only update/delete/approve
- `backend/app/tests/test_analytics.py`
  - period validation
  - progress limits
  - export idempotency + status
- `backend/app/tests/test_challenges.py`
- `backend/app/tests/test_achievements.py`
- `backend/app/tests/test_emergency.py`

### Frontend (jest + RTL)

- `frontend/src/__tests__/workouts/WorkoutDetailPage.test.tsx`
  - active draft validations + complete mutation payload + error rendering
- `frontend/src/__tests__/workouts/WorkoutsPage.test.tsx`
  - draft banner logic + start from template navigation
- `frontend/src/__tests__/shared/useWorkoutSessionDraftCloudSync.test.ts`
  - cloud/local merge + flush on pagehide/visibilitychange
- `frontend/src/__tests__/exercises/Catalog.test.tsx`
- `frontend/src/__tests__/analytics/AnalyticsPage.test.tsx`

## E2E (recommended to add later)

No E2E framework is currently present (no Playwright/Cypress directories found). When ready, start with:

- **E2E-1**: template → start → mark a set → complete → appears in history
- **E2E-2**: offline mode (queue) → restore network → sync flush succeeds

