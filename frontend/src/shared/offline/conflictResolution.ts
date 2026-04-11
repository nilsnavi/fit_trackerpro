import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { notifyWorkoutSyncConflictDetected } from '@shared/offline/observability/workoutSyncTelemetry'

/**
 * Conflict resolution strategy for offline-synced workouts.
 * When version mismatch occurs, merge local changes with server version.
 */

export interface ConflictResolutionResult {
  strategy: 'local-wins' | 'server-wins' | 'manual-merge'
  merged?: WorkoutHistoryItem
  conflictField?: string
  serverValue?: unknown
  localValue?: unknown
}

/**
 * Detect if exercises have significant changes (not just timestamps).
 */
export function exercisesSignificantlyDifferent(
  local: WorkoutHistoryItem['exercises'],
  server: WorkoutHistoryItem['exercises'],
): boolean {
  if (local.length !== server.length) return true

  for (let i = 0; i < local.length; i++) {
    const localE = local[i]
    const serverE = server[i]

    if (localE.name !== serverE.name) return true
    if (localE.sets_completed.length !== serverE.sets_completed.length) return true

    for (let j = 0; j < localE.sets_completed.length; j++) {
      const localS = localE.sets_completed[j]
      const serverS = serverE.sets_completed[j]

      // Check actual completion data
      if (
        localS.completed !== serverS.completed ||
        localS.weight !== serverS.weight ||
        localS.reps !== serverS.reps ||
        localS.duration !== serverS.duration ||
        localS.distance !== serverS.distance
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Simple merge strategy: keep local exercises, add/update metadata from server.
 * This assumes we want to preserve the user's local edits.
 */
export function mergeConflictedWorkout(
  localWorkout: WorkoutHistoryItem,
  serverWorkout: WorkoutHistoryItem,
): WorkoutHistoryItem {
  // Preserve local exercises and user-entered fields from in-progress edit.
  return {
    ...serverWorkout,
    exercises: localWorkout.exercises,
    comments: localWorkout.comments,
    tags: localWorkout.tags,
    glucose_before: localWorkout.glucose_before,
    glucose_after: localWorkout.glucose_after,
  }
}

/**
 * Зафиксировать конфликт версий (телеметрия + Sentry при включённом DSN).
 */
export function logConflict(
  workoutId: number,
  localVersion: number,
  serverVersion: number,
  reason: string,
): void {
  notifyWorkoutSyncConflictDetected({
    resource: 'workout',
    resource_id: workoutId,
    local_version: localVersion,
    server_version: serverVersion,
    reason,
    source: 'merge_util',
  })
}
