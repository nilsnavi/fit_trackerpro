import type { WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

export function workoutDraftLocalStorageKey(userId: string | number, workoutId: number): string {
    return `workout_draft_${userId}_${workoutId}`
}

export function writeWorkoutDraftToLocalStorage(
    userId: string | number,
    workoutId: number,
    payload: WorkoutSessionUpdateRequest,
): void {
    try {
        window.localStorage.setItem(
            workoutDraftLocalStorageKey(userId, workoutId),
            JSON.stringify({ v: 1 as const, payload }),
        )
    } catch {
        // storage full or disabled
    }
}

export function clearWorkoutDraftFromLocalStorage(userId: string | number, workoutId: number): void {
    try {
        window.localStorage.removeItem(workoutDraftLocalStorageKey(userId, workoutId))
    } catch {
        // noop
    }
}
