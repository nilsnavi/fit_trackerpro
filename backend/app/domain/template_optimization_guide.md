"""
Workout Template System - Optimization & Best Practices

This document outlines recommended practices for maintaining and extending
the template system to ensure consistency and reliability.
"""

# ============================================================================
# OPTIMIZATION: Exercise Order Mutation Safety
# ============================================================================
#
# CURRENT BEHAVIOR:
# - exercise_order is applied via _apply_reorder() in patch_template
# - This reorders the exercises list while preserving all existing data
# - Version field is atomically incremented
#
# BEST PRACTICE:
# - Always use PATCH /templates/{id} with exercise_order for reordering
# - Never PUT full exercises[] without version check
# - Client should track version and pass expected_version in every PATCH
#
# EXAMPLE FLOW:
#
# 1. Client loads template v=3
# 2. User drags exercise B to position 0
# 3. Client sends PATCH:
#    {
#      "expected_version": 3,
#      "exercise_order": [
#        { "index": 0, "exercise_id": "ex_456" },  # B moved here
#        { "index": 1, "exercise_id": "ex_123" },  # A
#        { "index": 2, "exercise_id": "ex_789" },  # C
#      ]
#    }
# 4. Backend reorders to match indices, increments version to 4
# 5. Client receives updated template with v=4
# 6. If PATCH fails (conflict), client shows "Template was updated by X"
#
# ============================================================================

# OPTIMIZATION: Batch Exercise Updates
# ============================================================================
#
# When editing multiple exercises AND reordering in one operation:
#
# SINGLE PATCH (recommended):
# {
#   "expected_version": 3,
#   "exercises": [...new exercises...],
#   "exercise_order": [...reorder...]
# }
# → Single atomic update, single version increment
#
# SEPARATE OPERATIONS (avoid):
# 1. PATCH exercises → v4
# 2. PATCH exercise_order → v5
# → Two round-trips, race condition window
#
# ============================================================================

# OPTIMIZATION: Frontend Caching & Validation
# ============================================================================
#
# useTemplateEditorStore should:
# 1. Store template.version along with exercises
# 2. Before sending PATCH, verify local changes against server
# 3. On conflict: merge strategy (theirs/ours/prompt user)
# 4. Show version badge in editor UI (for awareness)
#
# Current implementation: ✓ Tracks and validates
# 
# Recommendation: Add version awareness to UI
#   - Show "This template was updated" notification
#   - Allow user to review server copy vs local copy
#   - Provide merge/overwrite options
#
# ============================================================================

# OPTIMIZATION: Query Performance (Template List)
# ============================================================================
#
# Current indexes (verified in migrations):
# - (user_id, is_archived, created_at DESC) → fast listing
# - (user_id, type, is_archived) → fast filtering
# - (user_id, is_public, created_at DESC) → fast public templates
#
# Further optimizations:
# 1. Add index: (user_id, updated_at DESC) for recent templates
# 2. Cache: Favorite/pinned templates in fast storage
# 3. Pagination: Keep page_size reasonable (10-20 templates)
#
# Current implementation: ✓ Good indexes, effective pagination
#
# ============================================================================

# OPTIMIZATION: Exercise Copying Strategy
# ============================================================================
#
# When starting workout from template:
#
# Current implementation (safe):
# ```python
# initial_exercises = [
#     _exercise_template_to_workout_draft(ex, idx)
#     for idx, ex in enumerate(template.exercises or [])
# ]
# ```
# This creates NEW dict objects, preventing reference sharing
#
# Why this matters:
# - If template.exercises[0] is a dict reference, modifying workout
#   exercises would mutate the template
# - Creating new dicts via model_dump() ensures deep copy
#
# Current implementation: ✓ Safe deepcopy via model_validate/model_dump
#
# ============================================================================

# PERFORMANCE: Template Preloading
# ============================================================================
#
# Recommended for Home page quick-start:
#
# 1. Fetch templates with staleTime: 60_000ms
# 2. Group by: favorites (5), recent (10), all (rest)
# 3. Prefetch: Exercise catalog for template exercises
#
# Current Home integration:
#   - useHomeWorkoutTemplatesQuery: fetches and maps templates
#   - Lazy loads only when Home page visible
#   - Uses QueryClient prefetch for anticipated navigation
#
# Current implementation: ✓ Good lazy loading strategy
#
# ============================================================================

# SCHEMA: Template vs WorkoutLog Exercise Differences
# ============================================================================
#
# ExerciseInTemplate (in WorkoutTemplate.exercises):
# {
#   "exercise_id": 123,
#   "name": "Жим штанги",
#   "sets": 3,
#   "reps": 8,
#   "weight": 100,  # kg
#   "duration": null,
#   "rest_seconds": 120,
#   "notes": "На груди, классический хват"
# }
#
# CompletedExercise (in WorkoutLog.exercises):
# {
#   "exercise_id": 123,
#   "name": "Жим штанги",
#   "sets_completed": [
#     {
#       "set_number": 1,
#       "reps": 8,
#       "weight": 100,
#       "duration": null,
#       "rpe": 7.5,
#       "notes": "OK"
#     },
#     {
#       "set_number": 2,
#       "reps": 8,
#       "weight": 100,
#       "rpe": 8,
#       "notes": "A bit hard"
#     },
#     ...
#   ]
# }
#
# Key differences:
# - Template: planned (sets, reps, weight, rest)
# - Workout: actual (sets_completed, rpe per set, actual weight/reps)
# - Template: singular "duration" field (cardio)
# - Workout: duration per set (for flexibility)
#
# ============================================================================

# CONSISTENCY: Template Validation Rules
# ============================================================================
#
# When creating/editing template, validate:
#
# 1. Name: 1-255 characters, non-empty after trim
# 2. Type: one of (cardio, strength, flexibility, mixed)
# 3. Exercises: each must have:
#    - exercise_id > 0
#    - name: non-empty
#    - sets: 1-999 (for strength)
#    - reps: 1-999 (if present)
#    - duration: 1-9999 (if present, for cardio)
#    - weight: 0.1-1000 (if present)
#    - rest_seconds: 0-3600
# 4. Total exercises: 1-500 (prevent bloat)
# 5. Total duration estimate: 5-600 minutes (prevent outliers)
#
# Frontend validation: ✓ useTemplateEditorStore + schema validation
# Backend validation: ✓ WorkoutTemplateCreate schema + service checks
#
# Recommendation: Add constraints to DB for durability
#
# ============================================================================

CHECKLIST = """
Template System Best Practices Checklist:

IMMUTABILITY & SAFETY:
☑ Templates are never mutated except via explicit API calls
☑ Templates are deep-copied when creating workouts (new dict via model_dump)
☑ WorkoutLog.template_id is a historical reference only (read-only)
☑ Version field protects against concurrent modifications
☑ Optimistic locking: expected_version in PATCH payload

PERFORMANCE:
☑ Indexes exist for (user_id, is_archived, created_at DESC)
☑ Indexes exist for (user_id, type, is_archived)
☑ Pagination limit: 20 templates per page
☑ Stale time: 60s for template list queries
☑ Recent tab caches top 10 templates

UX:
☑ Recent templates section shows top 3 with quick-start
☑ Template preview modal shows all exercises before start
☑ Inline exercise preview in cards (first 2 + count)
☑ Favoriting limited to 5 pinned templates
☑ Clear status for archived/public/private

CONFLICT HANDLING:
☑ Version conflict returns 409 with error message
☑ Client disables edit on stale version
☑ Conflict notification shows in UI
☑ User can refresh and retry after conflict

DOMAIN VALIDATION:
☑ Template name: 1-255 chars, validating trim()
☑ Type validation: cardio, strength, flexibility, mixed
☑ Exercise count: 1-500
☑ Duration estimate: within reasonable bounds

DATA INTEGRITY:
☑ No missing references (FK constraints)
☑ No cascading deletes on template (explicit)
☑ Workout history preserved independently
☑ Audit logs track all template mutations
"""
