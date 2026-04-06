# FitTracker Pro - Roadmap Issues Pack

Date: 2026-04-06
Source: FINAL_CHANGELOG_AND_ROADMAP_2026-04-06.md
Format: Ready-to-create GitHub Issues

## Priority Legend

- P0: critical MVP completion
- P1: high impact next iteration
- P2: post-stabilization improvements

## Estimate Legend

- S: up to 2 dev-days
- M: 3-5 dev-days
- L: 6+ dev-days

## Dependency Map

- Issue 2 depends on Issue 1.
- Issue 3 depends on Issue 2.
- Issue 4 depends on Issue 3.
- Issue 5 depends on Issue 4.
- Issue 6 depends on Issue 3.
- Issue 7 depends on Issue 4.
- Issue 8 depends on Issue 5 and Issue 6.

---

## Issue 1

Title: P0 - Implement Telegram auth onboarding UX

Labels:
- roadmap
- feature
- auth
- frontend
- P0
- estimate-M

Description:
Implement a real onboarding/authentication user flow in frontend for Telegram Mini App.

Scope:
- Add auth entry flow from Telegram init data.
- Exchange init data with backend auth endpoint.
- Persist/refresh auth token with clear lifecycle handling.
- Add route guards for protected routes.
- Add clear unauthorized/re-auth UX state.

Acceptance Criteria:
- New user can sign in from Mini App without manual token injection.
- Protected routes are blocked for unauthorized users.
- Refresh flow is handled without random logout loops.
- Unauthorized state has actionable UX.

Definition of Done:
- Unit tests for guard/token lifecycle logic.
- One E2E happy path auth test.
- Docs updated for local auth test flow.

Dependencies:
- None.

---

## Issue 2

Title: P0 - Replace workout builder mock exercises with API catalog

Labels:
- roadmap
- feature
- workouts
- frontend
- backend
- P0
- estimate-M

Description:
Replace mock exercise data source in workout builder with real API-backed catalog integration.

Scope:
- Use real exercise catalog API in builder picker.
- Keep existing draft autosave behavior.
- Validate payload integrity using real exercise IDs.
- Handle loading/empty/error states in builder exercise picker.

Acceptance Criteria:
- Template creation works with real catalog exercises only.
- No mock exercise references remain in builder flow.
- Template can be started immediately after creation.

Definition of Done:
- Integration tests for builder payload mapping.
- Regression test for draft recovery with API-backed items.

Dependencies:
- Depends on Issue 1 for consistent protected access.

---

## Issue 3

Title: P0 - Add explicit offline/retry status UX in active workout flow

Labels:
- roadmap
- feature
- workouts
- frontend
- ux
- P0
- estimate-S

Description:
Expose clear user-facing status for mutation outcomes in active workout session.

Scope:
- Show explicit states: success, queued offline, retrying, failed.
- Standardize error toasts/messages for complete/start/update actions.
- Add recovery actions in UI when operation fails.

Acceptance Criteria:
- User always knows if action was applied, queued, or failed.
- Retry action is available when relevant.
- Offline queue states are visible and understandable.

Definition of Done:
- UI tests for state rendering.
- Manual test checklist for offline mode and reconnect behavior.

Dependencies:
- Depends on Issue 2.

---

## Issue 4

Title: P1 - Wire analytics page to live backend endpoints

Labels:
- roadmap
- feature
- analytics
- frontend
- backend
- P1
- estimate-M

Description:
Replace analytics mock generator with live API integration.

Scope:
- Connect analytics page to backend analytics endpoints.
- Align frontend filters/date ranges with backend contracts.
- Add per-widget loading, empty, and error handling.

Acceptance Criteria:
- Analytics reflects real user training data after workout completion.
- No mock-only data source remains on analytics page.
- Chart blocks handle error/empty states gracefully.

Definition of Done:
- Contract tests for analytics adapters.
- E2E check from completed workout to analytics update.

Dependencies:
- Depends on Issue 3.

---

## Issue 5

Title: P1 - Add dependency-aware readiness checks

Labels:
- roadmap
- reliability
- backend
- devops
- P1
- estimate-M

Description:
Improve service health strategy by introducing readiness behavior based on DB/Redis availability.

Scope:
- Keep liveness endpoint lightweight.
- Add readiness endpoint or readiness mode including DB/Redis dependency checks.
- Return non-success code for readiness when dependencies are unavailable.
- Update deploy and smoke checks accordingly.

Acceptance Criteria:
- Liveness and readiness semantics are clearly separated.
- Deployment validation uses readiness in production-like checks.
- Degraded dependencies are detectable by orchestrator and operators.

Definition of Done:
- Backend tests for readiness scenarios.
- Docs updated with endpoint semantics and runbook usage.

Dependencies:
- Depends on Issue 4.

---

## Issue 6

Title: P1 - Harden rollback playbook for schema-evolving releases

Labels:
- roadmap
- reliability
- database
- devops
- P1
- estimate-S

Description:
Create explicit rollback decision tree for app image rollback versus DB rollback/downgrade.

Scope:
- Document when image rollback alone is safe.
- Document when DB restore or alembic downgrade is required.
- Add first-deploy rollback caveat handling.
- Align manual runbook with CI deploy sequence.

Acceptance Criteria:
- On-call can choose rollback path in less than 5 minutes.
- Runbook includes migration compatibility checks.
- First deployment edge case is explicitly covered.

Definition of Done:
- Updated deployment and rollback docs reviewed by backend/devops.
- Dry-run tabletop scenario completed.

Dependencies:
- Depends on Issue 3.

---

## Issue 7

Title: P1 - Create end-to-end regression for MVP golden path

Labels:
- roadmap
- test
- e2e
- ci
- P1
- estimate-M

Description:
Add deterministic E2E regression covering core MVP path.

Scope:
- Cover flow: auth -> create template -> start workout -> complete workout -> analytics visible.
- Stabilize selectors and test data fixtures.
- Avoid flaky parallel suite contention for local and CI reliability.

Acceptance Criteria:
- Golden path test runs reliably in CI.
- Local execution guidance for stable runs is documented.
- Test blocks merges on regression.

Definition of Done:
- CI job added or updated with clear pass/fail gate.
- Flakiness tracked below agreed threshold.

Dependencies:
- Depends on Issue 4.

---

## Issue 8

Title: P2 - Enhance workout session data depth (rest and intensity insights)

Labels:
- roadmap
- feature
- workouts
- analytics
- P2
- estimate-L

Description:
Expand session model and UX to support richer rest/intensity tracking and post-session insights.

Scope:
- Confirm product contract for rest/intensity fields.
- Persist and surface richer session metrics.
- Keep backward compatibility for existing logs.
- Improve post-session summary UX based on new data.

Acceptance Criteria:
- New metrics are visible and meaningful in session summary/analytics.
- Historical records remain readable and stable.
- No regressions in complete workout flow.

Definition of Done:
- Migration plan validated.
- Backward compatibility tested on sample historical data.
- UX reviewed for clarity and usefulness.

Dependencies:
- Depends on Issue 5 and Issue 6.

---

## Suggested Milestone Grouping

Milestone Sprint 1:
- Issue 1
- Issue 2

Milestone Sprint 2:
- Issue 3
- Issue 4

Milestone Sprint 3:
- Issue 5
- Issue 6
- Issue 7

Milestone Sprint 4:
- Issue 8

## Suggested Creation Order

1. Issue 1
2. Issue 2
3. Issue 3
4. Issue 4
5. Issue 5
6. Issue 6
7. Issue 7
8. Issue 8
