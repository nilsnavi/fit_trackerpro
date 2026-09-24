import type {
    CompletedExercise,
    CompletedSet,
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'

export type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility' | 'custom'

export type AddItemKind = 'exercise' | 'timer'

export const FALLBACK_REST_PRESETS_SECONDS: number[] = [45, 60, 90, 120, 180]

export function parseTagsInput(value: string): string[] {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
}

export function formatElapsedDuration(totalSeconds: number): string {
    const normalized = Math.max(0, Math.floor(totalSeconds))
    const hours = Math.floor(normalized / 3600)
    const minutes = Math.floor((normalized % 3600) / 60)
    const seconds = normalized % 60

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatSetSnapshot(set?: CompletedSet): string {
    if (!set) return 'Нет данных'

    const parts = [
        typeof set.weight === 'number' ? `${set.weight} кг` : null,
        typeof set.reps === 'number' ? `${set.reps} повт` : null,
        typeof set.duration === 'number' ? `${set.duration} сек` : null,
        typeof set.distance === 'number' ? `${set.distance} км` : null,
    ].filter((part): part is string => Boolean(part))

    return parts.length > 0 ? parts.join(' • ') : 'Нет данных'
}

export function buildSyncPayload(workout: WorkoutHistoryItem): WorkoutSessionUpdateRequest {
    return {
        exercises: workout.exercises,
        comments: workout.comments,
        tags: workout.tags ?? [],
        glucose_before: workout.glucose_before,
        glucose_after: workout.glucose_after,
        // SPEC-005 §21/§24: superset/triset/circuit blocks of the session. Sent as
        // a full replacement list, matching the update request contract.
        blocks: workout.blocks ?? [],
    }
}

export function nextExerciseId(exercises: CompletedExercise[]): number {
    return exercises.reduce((maxId, exercise) => Math.max(maxId, exercise.exercise_id), 1000) + 1
}

/**
 * SPEC-005 §20: a set measured by time instead of reps. Completion stores `0`
 * reps for timed sets, so a falsy reps value (undefined or 0) means «timed».
 */
export function isTimedSet(set: CompletedSet): boolean {
    return typeof set.duration === 'number' && set.duration > 0 && !set.reps
}

/** SPEC-005 §20: default duration applied when a set is switched to time. */
export const DEFAULT_TIMED_SET_SECONDS = 60

/**
 * SPEC-005 §11: append a set that copies the previous working set's weight, reps
 * target and (for timed work) duration, so the user never retypes the same values.
 */
export function appendPrefilledSet(exercise: CompletedExercise): CompletedExercise {
    const previous =
        [...exercise.sets_completed].reverse().find((set) => set.set_type !== 'warmup') ??
        exercise.sets_completed[exercise.sets_completed.length - 1]

    const next: CompletedSet = {
        set_number: exercise.sets_completed.length + 1,
        set_type: previous?.set_type && previous.set_type !== 'warmup' ? previous.set_type : 'working',
        completed: false,
    }

    if (previous) {
        if (previous.weight != null) next.weight = previous.weight
        if (isTimedSet(previous)) next.duration = previous.duration
        else next.reps = previous.reps ?? 10
    } else {
        next.reps = 10
    }

    return { ...exercise, sets_completed: [...exercise.sets_completed, next] }
}

