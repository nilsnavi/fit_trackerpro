/**
 * Converts WorkoutModeExerciseItem[] to the shapes expected by backend APIs.
 */
import type { CompletedExercise, CompletedSet, ExerciseInTemplate } from '@features/workouts/types/workouts'
import type {
    CardioExerciseParams,
    FunctionalExerciseParams,
    StrengthExerciseParams,
    WorkoutModeExerciseItem,
    YogaExerciseParams,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'

// ── To template (save) ───────────────────────────────────────────────────────

export function mapEditorExercisesToTemplate(
    items: WorkoutModeExerciseItem[],
): ExerciseInTemplate[] {
    return items.map((item) => {
        const base = {
            exercise_id: item.exerciseId,
            name: item.name,
        }
        switch (item.mode) {
            case 'strength': {
                const p = item.params as StrengthExerciseParams
                return {
                    ...base,
                    sets: p.sets,
                    reps: p.reps,
                    weight: p.weight,
                    rest_seconds: p.restSeconds,
                    notes: p.note,
                }
            }
            case 'cardio': {
                const p = item.params as CardioExerciseParams
                return {
                    ...base,
                    sets: 1,
                    duration: p.durationSeconds,
                    rest_seconds: 0,
                    notes: p.note,
                }
            }
            case 'functional': {
                const p = item.params as FunctionalExerciseParams
                return {
                    ...base,
                    sets: p.rounds,
                    reps: p.reps,
                    duration: p.durationSeconds,
                    rest_seconds: p.restSeconds,
                    notes: p.note,
                }
            }
            case 'yoga': {
                const p = item.params as YogaExerciseParams
                return {
                    ...base,
                    sets: 1,
                    duration: p.durationSeconds,
                    rest_seconds: 0,
                    notes: p.note,
                }
            }
        }
    })
}

// ── To active workout (save & start) ─────────────────────────────────────────

export function mapEditorExercisesToCompleted(
    items: WorkoutModeExerciseItem[],
): CompletedExercise[] {
    return items.map((item) => {
        const base = {
            exercise_id: item.exerciseId,
            name: item.name,
        }
        switch (item.mode) {
            case 'strength': {
                const p = item.params as StrengthExerciseParams
                const sets: CompletedSet[] = Array.from({ length: p.sets }, (_, i) => ({
                    set_number: i + 1,
                    reps: p.reps,
                    weight: p.weight,
                    completed: false,
                }))
                return { ...base, sets_completed: sets, notes: p.note }
            }
            case 'cardio': {
                const p = item.params as CardioExerciseParams
                const sets: CompletedSet[] = [
                    {
                        set_number: 1,
                        duration: p.durationSeconds,
                        distance: p.distance,
                        completed: false,
                    },
                ]
                return { ...base, sets_completed: sets, notes: p.note }
            }
            case 'functional': {
                const p = item.params as FunctionalExerciseParams
                const sets: CompletedSet[] = Array.from({ length: p.rounds }, (_, i) => ({
                    set_number: i + 1,
                    reps: p.reps,
                    duration: p.durationSeconds,
                    completed: false,
                }))
                return { ...base, sets_completed: sets, notes: p.note }
            }
            case 'yoga': {
                const p = item.params as YogaExerciseParams
                const sets: CompletedSet[] = [
                    { set_number: 1, duration: p.durationSeconds, completed: false },
                ]
                return { ...base, sets_completed: sets, notes: p.note }
            }
        }
    })
}
