/**
 * Types for the WorkoutMode editor (exercise list builder before starting/saving a workout).
 */

export type EditorWorkoutMode = 'strength' | 'cardio' | 'functional' | 'yoga'

// ── Per-mode exercise parameter shapes ──────────────────────────────────────

export interface StrengthExerciseParams {
    sets: number
    reps: number
    weight?: number
    restSeconds: number
    note?: string
}

export interface CardioExerciseParams {
    durationSeconds: number
    distance?: number
    intensity?: 'low' | 'medium' | 'high'
    note?: string
}

export interface FunctionalExerciseParams {
    rounds: number
    reps?: number
    durationSeconds?: number
    restSeconds: number
    note?: string
}

export interface YogaExerciseParams {
    durationSeconds: number
    note?: string
}

export type ModeExerciseParams =
    | StrengthExerciseParams
    | CardioExerciseParams
    | FunctionalExerciseParams
    | YogaExerciseParams

// ── Editor exercise item ─────────────────────────────────────────────────────

export interface WorkoutModeExerciseItem {
    /** Client-side uuid for list keys and operations. */
    id: string
    exerciseId: number
    name: string
    category?: string
    mode: EditorWorkoutMode
    params: ModeExerciseParams
}

// ── Validation ───────────────────────────────────────────────────────────────

export type WorkoutModeEditorValidationKey = 'title' | 'exercises'
export type WorkoutModeEditorValidationErrors = Partial<
    Record<WorkoutModeEditorValidationKey, string>
>

// ── Default params factory ───────────────────────────────────────────────────

export function defaultParamsForMode(mode: EditorWorkoutMode): ModeExerciseParams {
    switch (mode) {
        case 'strength':
            return { sets: 3, reps: 10, restSeconds: 90 } satisfies StrengthExerciseParams
        case 'cardio':
            return { durationSeconds: 600 } satisfies CardioExerciseParams
        case 'functional':
            return { rounds: 3, reps: 10, restSeconds: 30 } satisfies FunctionalExerciseParams
        case 'yoga':
            return { durationSeconds: 60 } satisfies YogaExerciseParams
    }
}
