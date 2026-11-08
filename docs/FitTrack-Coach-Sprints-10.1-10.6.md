# FitTrack Coach — Implementation Prompts
## Sprints 10.1–10.6 for Codex / Hermes

**Repository:** `nilsnavi/fit_trackerpro`  
**Base specification:** `SPEC-010 — FitTrack Coach`  
**Mode:** strict phased implementation  
**Rule:** do not start the next sprint until the current sprint is fully green and explicitly closed.

---

# GLOBAL IMPLEMENTATION RULES

These rules apply to every sprint.

## 0.1 Architecture

Follow the existing project architecture:

```text
HTTP / FastAPI
    ↓
application
    ↓
infrastructure repositories / integrations
    ↓
domain
```

Frontend:

```text
page / component
    ↓
feature hook / service
    ↓
shared API client
```

Do not bypass current architectural guards.

## 0.2 Mandatory constraints

DO NOT:

1. Create a second workout engine.
2. Duplicate `WorkoutTemplate`, `WorkoutLog`, `WorkoutSet`, `Exercise`.
3. Introduce Prisma.
4. Put business logic inside FastAPI routers.
5. Query DB directly from routers.
6. Call `fetch`/`axios` directly from React pages/components.
7. Store user role as a single `users.role`.
8. Trust a `client_id` from the frontend without object-level authorization.
9. Hard-delete audit-sensitive payment/package records.
10. Send Telegram messages inside the primary DB transaction.
11. Create N+1 queries for Coach dashboard or client lists.
12. Break existing SPEC-005 active workout flows.
13. Break SPEC-006 progression.
14. Break existing users who have no Coach relationship.
15. Modify unrelated architecture "for cleanliness".
16. Start future sprint scope early.

## 0.3 Required workflow before coding

At the start of EVERY sprint:

1. Read:
   - `docs/architecture.md`
   - `docs/architecture/backend.md`
   - DB schema governance docs
   - current OpenAPI contract generation flow
   - frontend network boundary policy
2. Inspect current `main`.
3. Record current test baseline.
4. Create an implementation map for this sprint.
5. Identify possible conflicts with current implementation.
6. Do not change code until the audit section is complete.

## 0.4 Test requirements

After every sprint run, at minimum:

### Backend
```bash
pytest
ruff check .
```

Run the exact commands used by the repository if different.

### Frontend
```bash
npm run typecheck
npm run lint
npm test
```

Run current repository-equivalent commands if script names differ.

### API contract
Regenerate and verify OpenAPI-generated frontend types.

### E2E
Run sprint-specific Playwright tests plus critical existing golden paths.

## 0.5 Reporting

At sprint completion output:

```text
SPRINT X.Y IMPLEMENTATION REPORT

Status: PASS / FAIL

Changed files:
- ...

Database:
- migrations:
- schema changes:

API:
- added:
- changed:
- unchanged:

Frontend:
- routes:
- hooks:
- pages/components:

Tests:
- backend:
- frontend:
- e2e:
- api contract:

Exact test counts:
- ...

Security checks:
- ...

Known risks:
- ...

Deferred items:
- ...

Git status:
- ...

Recommended commit message:
- ...
```

## 0.6 STOP rule

After completing the sprint:

> STOP. Do not start the next sprint.

Do not implement scope belonging to later phases even if it looks convenient.

---

# SPRINT 10.1 — Coach Identity + Relations

## Goal

Implement the foundational Coach identity and Coach↔Client relationship model.

At the end of this sprint:

```text
User
→ creates CoachProfile
→ obtains COACH capability
→ generates invitation
→ Client accepts
→ Coach sees Client
→ RBAC protects all relations
```

No programs yet.

---

## 10.1.1 Scope

Implement:

- `user_roles`
- `coach_profiles`
- `coach_clients`
- `coach_invitations`
- COACH capability
- Coach onboarding
- invitation creation
- invitation resolution
- invitation acceptance
- client list
- basic client detail
- Coach↔Client permission model foundation
- feature flag `FEATURE_COACH`
- object-level authorization
- rate limiting for invitations
- audit events

Do NOT implement:
- programs
- packages
- payments
- tasks
- attention engine
- subscription plans
- AI

---

## 10.1.2 Database

Create Alembic migrations for:

### `user_roles`

```text
id
user_id
role
created_at
```

Constraints:

```text
unique(user_id, role)
role IN ('COACH','SUPER_ADMIN','GYM_ADMIN')
```

### `coach_profiles`

```text
id
user_id UNIQUE
display_name
bio
specializations JSON
avatar_url
timezone
is_active
public_slug
created_at
updated_at
```

### `coach_clients`

```text
id
coach_id
client_id
status
permissions JSON
started_at
ended_at
archived_at
created_at
updated_at
```

Rules:
- `coach_id != client_id`
- no duplicate ACTIVE relationship for same pair
- indexes for coach/status and client/status

Statuses:

```text
ACTIVE
PAUSED
ARCHIVED
REVOKED
```

### `coach_invitations`

```text
id UUID
coach_id
client_hint
token_hash
status
expires_at
accepted_by_user_id
accepted_at
revoked_at
created_at
```

Statuses:

```text
PENDING
ACCEPTED
EXPIRED
REVOKED
```

Never persist raw invitation tokens.

---

## 10.1.3 Domain

Add explicit domain models.

Recommended files:

```text
backend/app/domain/user_role.py
backend/app/domain/coach_profile.py
backend/app/domain/coach_client.py
backend/app/domain/coach_invitation.py
```

Register models with the current domain registry/Alembic metadata mechanism.

Add domain errors:

```text
CoachProfileAlreadyExists
CoachProfileNotFound
CoachRoleRequired
CoachClientRelationshipNotFound
CoachClientAlreadyExists
CoachInvitationNotFound
CoachInvitationExpired
CoachInvitationAlreadyUsed
CoachInvitationRevoked
CoachPermissionDenied
```

Do not put HTTP logic in these exceptions.

---

## 10.1.4 Repositories

Create repositories for:

```text
CoachProfileRepository
CoachClientRepository
CoachInvitationRepository
UserRoleRepository
```

Required repository capabilities:

### CoachClientRepository
- list coach clients
- get active relationship
- get relationship by pair
- archive/revoke
- count active clients

Every lookup must support strict owner scoping.

---

## 10.1.5 Application services

Create:

```text
CoachIdentityService
CoachRelationshipService
CoachInvitationService
```

Responsibilities:

### CoachIdentityService
- create CoachProfile
- activate COACH role
- retrieve profile
- update profile

### CoachInvitationService
- create cryptographically secure token
- store hash only
- return raw token once
- expiration default 7 days
- revoke invitation
- resolve invitation
- accept invitation atomically

### CoachRelationshipService
- list clients
- get client relationship
- pause/archive/revoke
- permission checks

---

## 10.1.6 API

Add:

```text
POST   /api/v1/coach/profile
GET    /api/v1/coach/profile
PATCH  /api/v1/coach/profile

POST   /api/v1/coach/invitations
GET    /api/v1/coach/invitations
DELETE /api/v1/coach/invitations/{id}

GET    /api/v1/coach/invitations/resolve?token=...
POST   /api/v1/coach/invitations/accept

GET    /api/v1/coach/clients
GET    /api/v1/coach/clients/{client_id}
PATCH  /api/v1/coach/clients/{client_id}
DELETE /api/v1/coach/clients/{client_id}
```

Register router through current v1 registration mechanism.

---

## 10.1.7 RBAC

Introduce server-side helpers/dependencies with clear ownership.

Examples:

```text
require_coach
require_active_coach_client
require_coach_client_permission
```

Do not use frontend-only route protection as authorization.

Expected rules:

```text
Coach A → Client A = allowed
Coach A → Client B = not found / denied
Client → Coach-only endpoints = denied
Archived relationship → denied
Revoked relationship → denied
```

Prefer 404 for resources outside the current relationship scope to prevent enumeration.

---

## 10.1.8 Permissions

Initial default:

```json
{
  "workouts": true,
  "measurements": true,
  "progress_photos": false,
  "wellness": false,
  "habits": true
}
```

Do not expose sensitive/health data merely because relationship exists.

---

## 10.1.9 Frontend

Create Coach feature boundary.

Suggested:

```text
frontend/src/features/coach/
frontend/src/features/coach-clients/
```

Add routes:

```text
/coach/onboarding
/coach
/coach/clients
/coach/clients/:clientId
/coach/invite
```

Screens:

### Coach onboarding
Fields:
- display name
- specialization
- bio
- timezone

### Coach dashboard placeholder
Only:
- Coach identity
- active client count
- CTA `Добавить клиента`

Do not build monitoring widgets yet.

### Client list
Card:
- name
- avatar if available
- status

### Invite client
- generate link
- copy
- Telegram share
- pending invites

### Invitation accept
Client sees:
- coach name
- bio
- requested data permissions
- confirm CTA

---

## 10.1.10 Tests

Backend unit tests:

- token hashing
- expiration
- invitation state transitions
- role activation
- duplicate relationship protection
- permission defaults

API integration:

1. CoachProfile create.
2. Duplicate profile.
3. Invitation create.
4. Resolve.
5. Accept.
6. Reuse token.
7. Expired token.
8. Revoked token.
9. Self-invite.
10. Coach A cannot access Coach B client.
11. Client cannot call Coach list.
12. Archived relationship blocks access.

Frontend tests:
- onboarding
- empty client list
- invite state
- invitation accept
- error state
- revoked state

E2E:

Create:

```text
frontend/e2e/coach-relations.spec.ts
```

Golden flow:

```text
Coach auth
→ onboarding
→ create invitation
→ Client auth
→ accept
→ Coach sees Client
```

Security flow:
- forged client ID
- foreign relationship

---

## 10.1.11 Acceptance criteria

Sprint PASS only if:

- migrations clean
- CoachProfile works
- role association works
- invitation raw token is not persisted/logged
- invitation acceptance is atomic
- duplicate active relationships are impossible
- object authorization has negative tests
- Coach sees only own clients
- existing non-Coach user UX unaffected
- OpenAPI contract green
- full tests green

---

## 10.1.12 STOP

When all criteria pass:

```text
SPRINT 10.1 PASS
```

STOP.

Do not start Sprint 10.2.

---

# SPRINT 10.2 — Coach Programs + Assignment

## Goal

Allow Coach to compose programs from existing workout templates and assign them to connected Clients.

At the end:

```text
Coach
→ existing WorkoutTemplate
→ CoachProgram
→ ProgramDay
→ Assignment
→ Client sees assigned program
→ Client starts existing workout session
```

---

## 10.2.1 Scope

Implement:

- coach programs
- program days
- versioning
- assignment
- assignment lifecycle
- assigned-program client UI
- start assigned workout bridge
- workout source metadata
- idempotent start

Do NOT implement:
- packages/payments
- monitoring dashboard
- attention engine
- subscription plans
- AI

---

## 10.2.2 Database

Create:

### `coach_programs`

```text
id
coach_id
name
description
duration_weeks
status
version
created_at
updated_at
archived_at
```

Status:

```text
DRAFT
ACTIVE
ARCHIVED
```

### `coach_program_days`

```text
id
program_id
day_index
title
workout_template_id
order_index
notes
```

Rules:
- workout template belongs to Coach
- unique(program_id, order_index)

### `coach_program_assignments`

```text
id
coach_id
client_id
program_id
program_version
status
start_date
end_date
coach_message
assigned_at
paused_at
completed_at
created_at
updated_at
```

Status:

```text
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

Preserve program version/snapshot metadata.

---

## 10.2.3 Domain rules

1. Coach owns `WorkoutTemplate`.
2. ProgramDay references existing template.
3. Client never becomes owner of Coach's template.
4. Client receives an entitlement to start assigned workout.
5. Starting assignment creates normal existing workout session.
6. Session belongs to Client.
7. Template editing after assignment must not silently corrupt started assignment state.
8. Concurrent program updates use version checking.

---

## 10.2.4 Repositories

Add:

```text
CoachProgramRepository
CoachProgramAssignmentRepository
```

Required:
- list by coach
- get scoped program
- version-safe update
- get active assignment
- list assignments
- state transition persistence

---

## 10.2.5 Application

Create:

```text
CoachProgramService
CoachAssignmentService
CoachAssignedWorkoutService
```

### CoachProgramService
- create
- update
- archive
- add/remove/reorder days
- validate template ownership

### CoachAssignmentService
- assign program
- pause
- resume
- complete
- cancel
- query current assignment

### CoachAssignedWorkoutService
- validate active CoachClient
- validate active assignment
- validate ProgramDay
- invoke existing workout session creation logic
- add source metadata
- respect Idempotency-Key

Do not duplicate session creation business logic.

---

## 10.2.6 API

Coach:

```text
POST   /api/v1/coach/programs
GET    /api/v1/coach/programs
GET    /api/v1/coach/programs/{program_id}
PATCH  /api/v1/coach/programs/{program_id}
POST   /api/v1/coach/programs/{program_id}/archive

POST   /api/v1/coach/programs/{program_id}/days
PATCH  /api/v1/coach/programs/{program_id}/days/{day_id}
DELETE /api/v1/coach/programs/{program_id}/days/{day_id}
POST   /api/v1/coach/programs/{program_id}/days/reorder

POST   /api/v1/coach/clients/{client_id}/program-assignments
GET    /api/v1/coach/clients/{client_id}/program-assignments
PATCH  /api/v1/coach/clients/{client_id}/program-assignments/{assignment_id}
POST   .../{assignment_id}/pause
POST   .../{assignment_id}/resume
POST   .../{assignment_id}/complete
POST   .../{assignment_id}/cancel
```

Client:

```text
GET  /api/v1/me/coach
GET  /api/v1/me/coach/program
GET  /api/v1/me/coach/program/today
POST /api/v1/me/coach/program/days/{day_id}/start
```

---

## 10.2.7 Session source metadata

Ensure existing WorkoutSession/WorkoutLog can identify source.

Required logical fields:

```text
source_type = coach_program
source_id = assignment_id
source_program_day_id = day_id
```

Prefer extending current existing source model if available rather than introducing redundant fields.

---

## 10.2.8 Frontend Coach

Routes:

```text
/coach/programs
/coach/programs/new
/coach/programs/:programId
/coach/clients/:clientId/program
```

Screens:

### Program list
- drafts
- active
- archived

### Program builder
Metadata + ordered days.

Each day references existing WorkoutTemplate.

Do NOT create another exercise/set editor.

### Assign program
- select Client
- select Program
- start date
- coach message

---

## 10.2.9 Frontend Client

Add:

```text
Your Coach card
Assigned Program screen
Program Today screen
```

CTA:

```text
Начать тренировку
```

On click:
- POST assigned day start
- navigate to existing active workout route

---

## 10.2.10 Tests

Backend:
- foreign template rejected
- version conflict 409
- duplicate active assignment rules
- assignment state machine
- unauthorized Coach
- assignment to foreign Client
- start without assignment
- start paused assignment
- start with expired/revoked relationship
- idempotent start
- session user_id == client

Compatibility:
- SPEC-005 active workout tests
- SPEC-006 progression tests

E2E:

```text
frontend/e2e/coach-program-assignment.spec.ts
```

Flow:

```text
Coach
→ create program
→ add existing template
→ assign
→ Client sees program
→ start workout
→ existing active workout opens
→ complete one session
```

---

## 10.2.11 Acceptance

PASS if:

- Program model works
- program day uses existing template
- assignment is scoped
- version conflicts protected
- start is idempotent
- existing session engine is used
- Client owns created session
- SPEC-005 passes
- SPEC-006 passes
- OpenAPI green
- no duplicated workout models introduced

STOP after PASS.

---

# SPRINT 10.3 — Coach Monitoring + Progress

## Goal

Turn Coach from a program assignment tool into a real monitoring workspace.

At the end Coach sees:

```text
Client
→ last workout
→ adherence
→ progress
→ measurements
→ history
→ private notes
→ attention signals
```

---

## 10.3.1 Scope

Implement:

- Coach dashboard aggregates
- Client overview
- Client workout history read access
- Client workout detail read access
- Client progress
- body measurements read access
- adherence
- Coach notes
- attention engine v1
- permissions enforcement

No packages/payments yet.

---

## 10.3.2 Database

Create:

### `coach_notes`

```text
id
coach_id
client_id
text
category
created_at
updated_at
deleted_at
```

Categories:

```text
GENERAL
PROGRAM
PROGRESS
FOLLOW_UP
```

Optional:
Do NOT persist attention events unless needed.
Prefer computed attention for v1.

---

## 10.3.3 Privacy enforcement

Use `coach_clients.permissions`.

Required permissions:

```text
workouts
measurements
progress_photos
wellness
habits
```

Rules:

- no `workouts` → no workout history/detail/progress from workout data
- no `measurements` → body measurements hidden
- revocation is immediate
- notes never visible to Client

---

## 10.3.4 Application services

Create:

```text
CoachDashboardService
CoachClientOverviewService
CoachClientProgressService
CoachNotesService
CoachAttentionService
```

Reuse existing Training/Analytics logic where possible.

Do not duplicate analytics formulas.

---

## 10.3.5 API

```text
GET /api/v1/coach/dashboard

GET /api/v1/coach/clients/{client_id}/overview

GET /api/v1/coach/clients/{client_id}/workouts
GET /api/v1/coach/clients/{client_id}/workouts/{workout_id}

GET /api/v1/coach/clients/{client_id}/progress

GET    /api/v1/coach/clients/{client_id}/notes
POST   /api/v1/coach/clients/{client_id}/notes
PATCH  /api/v1/coach/clients/{client_id}/notes/{note_id}
DELETE /api/v1/coach/clients/{client_id}/notes/{note_id}
```

Dashboard query:

```text
date
timezone
```

Client progress query:

```text
period=7d|30d|90d|custom
from
to
```

---

## 10.3.6 Attention Engine v1

Rules:

### NO_WORKOUT
No completed workout for default 7 days.

### MISSED_PLANNED_WORKOUT
Assigned workout not completed within tolerance.

### MEASUREMENT_STALE
Only if measurements permission=true.

Do not implement PACKAGE_LOW yet. That belongs to Sprint 10.4.

Response:

```json
{
  "type": "NO_WORKOUT",
  "severity": "warning",
  "client_id": 17,
  "title": "9 дней без тренировки"
}
```

No medical diagnosis wording.

---

## 10.3.7 Dashboard performance

Must avoid N+1.

Target:
- p95 < 500 ms for 100 active clients

Build aggregate queries or efficient batched reads.

Do not loop over clients with one DB request each.

---

## 10.3.8 Frontend

Coach dashboard now becomes real.

Route:

```text
/coach
```

Widgets:
- active clients
- workouts today
- attention count
- tasks placeholder only if tasks not yet implemented

Attention cards:
- name
- reason
- direct navigation to Client

Client detail tabs:

```text
Overview
Workouts
Progress
Program
Notes
```

Package tab comes in 10.4.

---

## 10.3.9 Progress UI

Reuse existing analytics chart components.

Display:
- workouts count
- adherence
- volume trend
- e1RM
- latest PR
- weight trend
- body measurements

Only display data permitted by relationship permissions.

---

## 10.3.10 Coach Notes

Private.

Frontend:
- list
- create
- edit
- soft delete

Never appear:
- Client API
- Client page
- Telegram notifications
- product analytics payload

---

## 10.3.11 Tests

Security:
- workouts permission false
- measurements permission false
- revoked relationship
- foreign workout_id
- foreign note
- Client attempts notes API

Attention:
- 7+ days no workout
- recent workout resolves NO_WORKOUT
- missed planned day
- no false duplicate

Performance:
- query-count assertion if test infrastructure supports
- explicit no-N+1 test

E2E:

```text
frontend/e2e/coach-monitoring.spec.ts
```

Flow:
- Client completes assigned workout
- Coach dashboard reflects state
- Coach opens history
- Coach opens progress
- Coach creates note
- Client cannot see note

---

## 10.3.12 Acceptance

PASS if:

- Coach dashboard is usable
- no N+1
- history scoped
- progress scoped
- permission revocation works immediately
- notes private
- attention works
- existing client analytics unaffected
- tests green

STOP.

---

# SPRINT 10.4 — Coach Business: Packages, Payments, Tasks

## Goal

Turn FitTrack Coach into a product that manages the Trainer's operational business.

At the end:

```text
Client
→ package
→ sessions balance
→ usage ledger
→ payments
→ task
```

---

## 10.4.1 Scope

Implement:

- package templates
- client packages
- session usage ledger
- manual consume/reverse
- optional auto-consume hook
- payments
- payment reversal
- task management
- package-related attention

No external payment acquiring.

---

## 10.4.2 Database

Create:

### `coach_packages`
### `coach_client_packages`
### `coach_package_usage`
### `coach_payments`
### `coach_tasks`

Use fields from SPEC-010.

Important:
Do not rely on a simple `sessions_used` counter without ledger.

Ledger is authoritative audit history.

---

## 10.4.3 Package invariants

Must guarantee transactionally:

```text
0 <= sessions_used <= sessions_total
```

Consumption:
- create usage row
- update derived balance
- same DB transaction

Reversal:
- append reversal/correction row
- never delete old usage row

---

## 10.4.4 Auto consume

Setting:

```text
auto_consume_completed_workout
```

Default false.

When true:
- completed assigned workout may consume one session
- idempotent by workout id
- must not double-consume on repeated completion event

Do not hard-wire all workout completions to paid session consumption.

---

## 10.4.5 Payments

Payment is manually recorded.

Fields:
- amount
- currency
- payment method
- paid_at
- package reference optional
- comment

Reversal:
- status REVERSED
- original row retained
- reversed_at set

No hard delete.

No payment gateway in this sprint.

---

## 10.4.6 Tasks

Tasks:
- optional client
- title
- description
- priority
- due_at
- source
- completed_at

Sources:
- MANUAL
- SYSTEM

---

## 10.4.7 API

Packages:

```text
POST  /api/v1/coach/packages
GET   /api/v1/coach/packages
PATCH /api/v1/coach/packages/{package_id}

POST /api/v1/coach/clients/{client_id}/packages
GET  /api/v1/coach/clients/{client_id}/packages

POST /api/v1/coach/clients/{client_id}/packages/{id}/consume
POST /api/v1/coach/clients/{client_id}/packages/{id}/reverse
```

Payments:

```text
POST /api/v1/coach/clients/{client_id}/payments
GET  /api/v1/coach/clients/{client_id}/payments
POST /api/v1/coach/clients/{client_id}/payments/{payment_id}/reverse
```

Tasks:

```text
GET    /api/v1/coach/tasks
POST   /api/v1/coach/tasks
PATCH  /api/v1/coach/tasks/{id}
POST   /api/v1/coach/tasks/{id}/complete
DELETE /api/v1/coach/tasks/{id}
```

---

## 10.4.8 Attention

Add:

### PACKAGE_LOW
remaining <= 2

### PACKAGE_EXPIRED
expires_at < today

### PAYMENT_PENDING
Only if a clear deterministic status exists.

Avoid guessing financial debt from ambiguous data.

---

## 10.4.9 Frontend

Routes/screens:

```text
/coach/packages
/coach/clients/:clientId/package
/coach/clients/:clientId/payments
/coach/tasks
```

Client card should display:
- sessions remaining
- payment state where meaningful

Dashboard:
- packages low
- tasks today

---

## 10.4.10 Tests

Package:
- create
- consume
- consume beyond total
- duplicate consume with idempotency
- reverse
- double reverse
- concurrency two consumes
- auto-consume same workout twice

Payments:
- record
- reverse
- foreign client
- foreign payment
- hard delete unavailable

Tasks:
- create
- complete
- filter
- foreign task

E2E:

```text
frontend/e2e/coach-business.spec.ts
```

Flow:
- create package
- assign to Client
- consume one
- reverse one
- record payment
- reverse payment
- create task
- complete task

---

## 10.4.11 Acceptance

PASS if:

- package ledger is auditable
- balances never go negative
- idempotency protects consume
- payment rows never hard deleted
- tasks work
- dashboard reflects package/task signals
- object authorization green

STOP.

---

# SPRINT 10.5 — Telegram Automation

## Goal

Add asynchronous Telegram automation without coupling business transactions to Telegram availability.

---

## 10.5.1 Scope

Implement Telegram delivery for:

```text
coach.invitation.created
coach.program.assigned
coach.workout.missed
coach.package.low
coach.task.due
client.workout.reminder
```

No AI.

---

## 10.5.2 Architecture

Business transaction:

```text
DB commit
→ event/outbox/task
→ Telegram delivery worker
```

NOT:

```text
DB transaction
→ call Telegram
→ rollback on Telegram error
```

Use existing project worker/queue mechanism if available.

If existing project already has a reliable delivery abstraction, extend it instead of adding a second queue framework.

---

## 10.5.3 Delivery requirements

Each notification must support:
- dedupe key
- retry
- exponential/backoff compatible with current infra
- status logging without sensitive payload
- respect user notification preferences
- failure isolation

---

## 10.5.4 Invitation deep link

Generate Telegram deep link compatible with current bot/Mini App routing.

Requirements:
- invitation token not exposed in server logs
- web fallback
- expired token handled gracefully

---

## 10.5.5 Notification templates

Russian default.

Examples:

### Program assigned

```text
Алексей назначил вам новую программу:
Hypertrophy Base

Открыть программу
```

### Missed workout to Coach

```text
Иван Петров не выполнил запланированную тренировку.
```

### Package low

```text
У Анны осталось 2 занятия.
```

No medical claims.

---

## 10.5.6 Preferences

Respect existing notification settings.

If no adequate current granularity exists, add Coach notification preferences without changing legacy defaults unexpectedly.

---

## 10.5.7 Tests

Unit:
- event mapping
- dedupe
- retry
- disabled notifications

Integration:
- Telegram failure after DB commit
- repeated event not duplicated
- invalid Telegram recipient

E2E/mock:
- invitation deep link route
- assigned program message action
- notification does not alter business state

---

## 10.5.8 Acceptance

PASS if:

- Telegram failure never rolls back business mutation
- retries exist
- dedupe exists
- preferences honored
- deep link works
- logs exclude raw token/private note/payment comments

STOP.

---

# SPRINT 10.6 — Commercial Readiness: Trial, Entitlements, Product Analytics

## Goal

Make FitTrack Coach sellable as a controlled SaaS product.

At the end:

```text
new Coach
→ 14-day trial
→ client limit
→ entitlement checks
→ subscription screen
→ product analytics
→ release-ready
```

---

## 10.6.1 Scope

Implement:

- coach subscriptions
- trial
- plans
- client limits
- centralized entitlements
- subscription screen
- feature flags
- product analytics
- release readiness
- demo seed/support tooling where appropriate

No payment acquiring.

---

## 10.6.2 Database

Create:

### `coach_subscriptions`

```text
id
coach_id
plan
status
trial_started_at
trial_ends_at
period_started_at
period_ends_at
client_limit
entitlements JSON
created_at
updated_at
```

Plans:

```text
TRIAL
START
PRO
```

Statuses:

```text
TRIAL
ACTIVE
EXPIRED
CANCELLED
```

---

## 10.6.3 Trial

Default:

```text
14 days
5 active clients
core features enabled
```

When trial expires:

Allowed:
- read existing clients
- read history
- Client continues workouts
- existing assignments remain readable/usable according to product policy

Blocked:
- new client activation
- new commercial assignment if entitlement policy says so

Do not delete data.

---

## 10.6.4 Plans

### TRIAL
- active clients: 5
- programs
- monitoring
- packages

### START
- active clients: 20
- core features

### PRO
- active clients: 100
- advanced analytics entitlement
- future AI entitlement placeholder

Prices are configuration/product data, not hardcoded domain constants.

---

## 10.6.5 Entitlement service

Create centralized:

```text
CoachEntitlementService
```

Examples:

```text
require_active_client_slot
require_feature
get_limits
get_subscription
```

Do not scatter plan checks across routers.

---

## 10.6.6 API

```text
GET /api/v1/coach/subscription
```

Optional internal/admin-safe mutation path only if needed for testing/dev.

No public billing checkout unless an existing billing provider already exists and is explicitly in scope.

---

## 10.6.7 Frontend

Route:

```text
/coach/subscription
```

Show:
- plan
- status
- trial end
- active client usage
- limit
- enabled features
- upgrade CTA placeholder

When limit reached:
clear UX error:

```text
Достигнут лимит активных клиентов текущего тарифа.
```

Do not hide existing clients.

---

## 10.6.8 Product analytics

Events:

```text
coach_onboarding_completed
coach_client_invited
coach_client_activated
coach_program_created
coach_program_assigned
client_assigned_workout_started
client_assigned_workout_completed
coach_package_created
coach_payment_recorded
```

Do not include:
- notes text
- health values
- invitation tokens
- payment comments

Activation definition:

```text
CoachProfile created
AND >=1 active Client
AND >=1 Program assigned
```

Primary metric:

```text
weekly_active_coaches
```

---

## 10.6.9 Release hardening

Verify:
- FEATURE_COACH rollout
- migrations
- rollback plan
- Sentry
- logging
- Prometheus metrics
- backups
- Telegram deep links
- privacy/consent text
- demo Coach
- demo Client
- sample Program
- sample package
- support contact

---

## 10.6.10 QA

Entitlement:
- trial starts once
- trial expiry
- 5th Client allowed
- 6th Client blocked
- existing Clients readable
- Client workout still works after Coach trial expiry
- plan upgrade raises limit
- plan downgrade behavior deterministic

Security:
- Coach cannot forge subscription
- client cannot access subscription endpoint as Coach
- limits enforced backend-side

E2E:

```text
frontend/e2e/coach-commercial.spec.ts
```

Flow:
- new Coach gets trial
- invite to limit
- extra activation blocked
- subscription screen shows exact usage

---

## 10.6.11 Full regression gate

Before closing Sprint 10.6:

Run ALL:
- backend suite
- frontend unit suite
- typecheck
- lint
- API contract
- existing FitTracker golden path
- SPEC-005 critical path
- SPEC-006 progression critical path
- all Coach E2E
- mobile Android smoke
- mobile iOS smoke

Also test migrations:
1. fresh DB
2. populated DB snapshot

---

## 10.6.12 Final acceptance

FitTrack Coach is ready for pilot sale only if a Coach can:

```text
register
→ activate Coach
→ invite Client
→ assign Program
→ observe completed workout
→ inspect progress
→ manage package
→ record payment
→ receive Telegram automation
→ operate within trial/plan limits
```

and a Client can:

```text
accept Coach
→ view assigned Program
→ start existing workout
→ complete workout
→ continue using FitTracker Pro normally
```

with:
- no cross-tenant data leak
- no workout engine duplication
- no regression in existing user flows
- all release gates green

---

# FINAL STOP CONDITION

When Sprint 10.6 passes:

Output:

```text
FITTRACK COACH — PILOT READY

Release readiness:
PASS

Known non-blocking limitations:
...

Recommended pilot:
3–5 trainers
10–30 real clients
2–4 weeks
```

Then STOP.

Do not implement AI, nutrition, group coaching, gym management, white-label, internal messaging or payment acquiring until real pilot feedback is collected.
