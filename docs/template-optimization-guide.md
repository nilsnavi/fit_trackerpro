# Workout Template System — Optimization & Best Practices

This document outlines recommended practices for maintaining and extending
the template system to ensure consistency and reliability.

> **Note**: originally located in `backend/app/domain/` — moved to `docs/` during 2026-04 stabilization.

## Exercise Order Mutation Safety

**Current behavior:**
- `exercise_order` is applied via `_apply_reorder()` in `patch_template`
- This reorders the exercises list while preserving all existing data
- `version` field is atomically incremented

**Best practice:**
- Always use `PATCH /templates/{id}` with `exercise_order` for reordering
- Never `PUT` full `exercises[]` without a version check
- Client should track `version` and pass `expected_version` in every PATCH

**Example flow:**
```
1. Client loads template v=3
2. User drags exercise B to position 0
3. Client sends PATCH:
   {
     "expected_version": 3,
     "exercise_order": [
       { "index": 0, "exercise_id": "ex_456" },  # B moved here
       { "index": 1, "exercise_id": "ex_123" },  # A
       { "index": 2, "exercise_id": "ex_789" },  # C
     ]
   }
4. Backend reorders to match indices, increments version to 4
5. Client receives updated template with v=4
6. If PATCH fails (conflict), client shows "Template was updated by X"
```

## Batch Exercise Updates

When editing multiple exercises AND reordering in one operation:

**Single PATCH (recommended):**
```json
{
  "expected_version": 3,
  "exercises": ["...new exercises..."],
  "exercise_order": ["...reorder..."]
}
```
Single atomic update, single version increment.

**Separate operations (avoid):**
1. `PATCH exercises` → v4
2. `PATCH exercise_order` → v5

Two round-trips, race condition window.

## Frontend Caching & Validation

`useTemplateEditorStore` should:
1. Store `template.version` along with exercises
2. Before sending PATCH, verify local changes against server
3. On conflict: merge strategy (theirs/ours/prompt user)
4. Show version badge in editor UI (for awareness)

Current implementation: tracks and validates.

Recommendation: Add version awareness to UI
- Show "This template was updated" notification
- Allow user to review server copy vs local copy
- Provide merge/overwrite options

## Query Performance (Template List)

Current indexes (verified in migrations):
- `(user_id, is_archived, created_at DESC)` → fast listing
- `(user_id, type, is_archived)` → fast filtering
- `(user_id, is_public, created_at DESC)` → fast public templates

Further optimizations:
1. Add index: `(user_id, updated_at DESC)` for recent templates
2. Cache: Favorite/pinned templates in fast storage
3. Pagination: Keep `page_size` reasonable (10–20 templates)

Current implementation: Good indexes, effective pagination.

## Exercise Copying Strategy

When starting workout from template:

```python
initial_exercises = [
    _exercise_template_to_workout_draft(ex, idx)
    for idx, ex in enumerate(template.exercises or [])
]
```

This creates NEW dict objects, preventing reference sharing.

Why this matters:
- If `template.exercises[0]` is a dict reference, modifying workout exercises would mutate the template
- Creating new dicts via `model_dump()` ensures deep copy

Current implementation: Safe deepcopy via `model_validate` / `model_dump`.

## Template Preloading (Home Page)

Recommendations:
1. Fetch templates with `staleTime: 60_000ms`
2. Group by: favorites (5), recent (10), all (rest)
3. Prefetch: Exercise catalog for template exercises

Current Home integration:
- `useHomeWorkoutTemplatesQuery`: fetches and maps templates
- Lazy loads only when Home page visible
- Uses `QueryClient.prefetch` for anticipated navigation

## Schema: Template vs WorkoutLog Exercise Differences

**`ExerciseInTemplate`** (in `WorkoutTemplate.exercises`):
```json
{
  "exercise_id": 123,
  "name": "Bench Press",
  "sets": 3,
  "reps": 8,
  "weight": 100,
  "duration": null,
  "rest_seconds": 120,
  "notes": "Classic grip"
}
```

**`CompletedExercise`** (in `WorkoutLog.exercises`):
```json
{
  "exercise_id": 123,
  "name": "Bench Press",
  "sets_completed": [
    { "set_number": 1, "reps": 8, "weight": 100, "rpe": 7.5, "notes": "OK" },
    { "set_number": 2, "reps": 8, "weight": 100, "rpe": 8,   "notes": "A bit hard" }
  ]
}
```

Key differences:
- Template: planned (`sets`, `reps`, `weight`, `rest`)
- Workout: actual (`sets_completed`, RPE per set, actual weight/reps)

## Consistency: Template Validation Rules

| Field | Constraint |
|---|---|
| `name` | 1–255 chars, non-empty after trim |
| `type` | `cardio`, `strength`, `flexibility`, `mixed` |
| `exercise_id` | > 0 |
| `sets` | 1–999 (strength) |
| `reps` | 1–999 (if present) |
| `duration` | 1–9999 (cardio, if present) |
| `weight` | 0.1–1000 (if present) |
| `rest_seconds` | 0–3600 |
| Total exercises | 1–500 |
| Duration estimate | 5–600 minutes |

Frontend: `useTemplateEditorStore` + schema validation.
Backend: `WorkoutTemplateCreate` schema + service checks.

Recommendation: Add DB constraints for durability.

## Best Practices Checklist

**Immutability & Safety:**
- [x] Templates are never mutated except via explicit API calls
- [x] Templates are deep-copied when creating workouts (`model_dump`)
- [x] `WorkoutLog.template_id` is a historical reference only (read-only)
- [x] `version` field protects against concurrent modifications
- [x] Optimistic locking: `expected_version` in PATCH payload

**Performance:**
- [x] Indexes exist for `(user_id, is_archived, created_at DESC)`
- [x] Indexes exist for `(user_id, type, is_archived)`
- [x] Pagination limit: 20 templates per page
- [x] Stale time: 60s for template list queries
- [x] Recent tab caches top 10 templates

**UX:**
- [x] Recent templates section shows top 3 with quick-start
- [x] Template preview modal shows all exercises before start
- [x] Inline exercise preview in cards (first 2 + count)
- [x] Favoriting limited to 5 pinned templates
- [x] Clear status for archived/public/private

**Conflict Handling:**
- [x] Version conflict returns 409 with error message
- [x] Client disables edit on stale version
- [x] Conflict notification shows in UI
- [x] User can refresh and retry after conflict

**Domain Validation:**
- [x] Template name: 1–255 chars
- [x] Type validation: cardio, strength, flexibility, mixed
- [x] Exercise count: 1–500

**Data Integrity:**
- [x] No missing references (FK constraints)
- [x] No cascading deletes on template (explicit)
- [x] Workout history preserved independently
- [x] Audit logs track all template mutations
