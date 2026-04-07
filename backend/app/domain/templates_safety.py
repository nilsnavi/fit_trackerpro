"""
Template Immutability & Safety Patterns

This module documents the patterns used to ensure templates are never mutated
when workouts are completed or in-progress, maintaining template independence.
"""

# ============================================================================
# PATTERN: Template Data Flow
# ============================================================================
#
# Template (immutable source)
#   ↓ READ (in start_workout)
#   ↓ COPY exercises to WorkoutLog (via _exercise_template_to_workout_draft)
#   ↓ WorkoutLog is independent
#   ↓ User completes workout → only WorkoutLog is updated
#   ↓ Template remains unchanged
#
# Key invariants:
# 1. Templates are NEVER modified after creation except via explicit API calls
# 2. start_workout only READS template.exercises and copies them
# 3. complete_workout only modifies WorkoutLog.exercises, never touches template
# 4. Template version field tracks mutations (optimistic locking)
# 5. WorkoutLog.template_id is a historical reference (read-only)
#
# ============================================================================

# Backend Service: workouts_service.py
#
# async def start_workout(user_id, data):
#     template = await repo.get_template(...)  # READ
#     initial_exercises = [
#         _exercise_template_to_workout_draft(ex, idx)
#         for idx, ex in enumerate(template.exercises or [])
#     ]
#     workout = WorkoutLog(
#         template_id=template.id,  # Save reference, not copy
#         exercises=initial_exercises,  # COPY values, not reference
#         ...
#     )
#     return await repo.create_workout_log(workout)
#
# async def complete_workout(user_id, workout_id, data):
#     workout = await repo.get_workout(...)  # READ
#     # NEVER touch template!
#     workout.exercises = [ex.model_dump() for ex in data.exercises]
#     await repo.commit_workout_completion(workout)
#     # Template is untouched ✓
#
# ============================================================================

# Migration: optimistic concurrency via version field
#
# WorkoutTemplate fields:
#   - version: int (default=1)
#   - Check constraint: version >= 1
#
# When template is updated:
#   1. Client sends PATCH with expected_version
#   2. Backend WHERE clause: AND version = expected_version
#   3. Atomically increment: SET version = version + 1
#   4. If 0 rows affected → conflict (someone else updated it)
#   5. Client retries with latest version
#
# This prevents concurrent modifications while allowing safe reads
#
# ============================================================================

# Frontend: Optimistic UI + Conflict Handling
#
# useUpdateWorkoutTemplateMutation:
#   1. Optimistically update UI with pending changes
#   2. Include current template.version in PATCH payload
#   3. On conflict (409): invalidate cache, refetch latest
#   4. Show toast: "Template was updated, please review"
#   5. User can retry after reviewing changes
#
# ============================================================================

TEMPLATE_SAFETY_CHECKLIST = """
Template Immutability Verification Checklist:

☑ [BACKEND] start_workout: only READS template, copies exercises to WorkoutLog
☑ [BACKEND] start_workout_from_template_with_overrides: only READS template
☑ [BACKEND] _exercise_template_to_workout_draft: creates NEW dict, doesn't mutate
☑ [BACKEND] _resolve_start_overrides: creates NEW list, doesn't mutate source
☑ [BACKEND] complete_workout: only modifies WorkoutLog, NEVER touches template
☑ [BACKEND] All updates use optimistic locking (expected_version)
☑ [DB] Foreign key: WorkoutLog.template_id → WorkoutTemplate (read-only reference)
☑ [DB] WorkoutTemplate.version has CHECK constraint (>= 1)
☑ [DB] Indexes: (user_id, type, is_archived, updated_at) for fast listing
☑ [FRONTEND] start_workout_from_template_with_overrides sends StartWorkoutTemplateOverrides
☑ [FRONTEND] useUpdateWorkoutTemplateMutation includes expected_version
☑ [FRONTEND] Conflict handling: show user if template was modified by someone else
"""

# ============================================================================
# PATTERN: Exercise Reordering via PATCH
# ============================================================================
#
# Frontend sends PATCH with exercise_order (array of exercise_ids):
#
#   PATCH /templates/{id}
#   {
#     "expected_version": 3,
#     "exercise_order": [
#       { "index": 0, "exercise_id": "ex_123" },
#       { "index": 1, "exercise_id": "ex_456" },
#       { "index": 2, "exercise_id": "ex_789" },
#     ]
#   }
#
# Backend rebuilds exercises list in new order using specified indices.
# Atomically updates version to 4.
#
# ============================================================================
