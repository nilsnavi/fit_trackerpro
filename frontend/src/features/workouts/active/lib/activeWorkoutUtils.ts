import type {
    CompletedExercise,
    CompletedSet,
    WorkoutHistoryItem,
    WorkoutSessionUpdateRequest,
} from '@features/workouts/types/workouts'

export type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility'

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
    }
}

export function nextExerciseId(exercises: CompletedExercise[]): number {
    return exercises.reduce((maxId, exercise) => Math.max(maxId, exercise.exercise_id), 1000) + 1
}

