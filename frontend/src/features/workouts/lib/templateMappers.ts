import type { BackendWorkoutType, ExerciseInTemplate } from '../types/workouts'
import type { WorkoutBlock, WorkoutBuilderExercise } from '../types/workoutBuilder'
import type { WorkoutType } from '@shared/types'

export const mapWorkoutTypeToBackend = (types: WorkoutType[]): BackendWorkoutType => {
    const normalized = types.filter(
        (type) => type === 'cardio' || type === 'strength' || type === 'flexibility',
    )
    if (normalized.length !== 1) {
        return 'mixed'
    }
    return normalized[0]
}

export const toExerciseId = (id: string, fallbackIndex: number): number => {
    const parsed = Number.parseInt(id, 10)
    return Number.isNaN(parsed) ? fallbackIndex + 1 : parsed
}

export const mapBackendTypeToSelectedTypes = (type: BackendWorkoutType): WorkoutType[] => {
    if (type === 'mixed') {
        return []
    }
    return [type]
}

export const mapTemplateExercisesToBlocks = (exercises: ExerciseInTemplate[]): WorkoutBlock[] =>
    exercises.map((exercise, index) => {
        const isCardio =
            typeof exercise.duration === 'number' && exercise.duration > 0 && !exercise.reps
        return {
            id: `template-${exercise.exercise_id}-${index}`,
            type: isCardio ? 'cardio' : 'strength',
            exercise: {
                id: String(exercise.exercise_id),
                name: exercise.name,
                category: isCardio ? 'cardio' : 'strength',
            },
            config: {
                sets: exercise.sets,
                reps: exercise.reps,
                duration: exercise.duration ? Math.round(exercise.duration / 60) : undefined,
                restSeconds: exercise.rest_seconds,
                weight: exercise.weight,
                note: exercise.notes,
            },
            order: index,
        }
    })

export const buildTemplateExercises = (blocks: WorkoutBlock[]): ExerciseInTemplate[] =>
    blocks
        .filter(
            (block): block is WorkoutBlock & { exercise: WorkoutBuilderExercise } =>
                (block.type === 'strength' || block.type === 'cardio') && Boolean(block.exercise),
        )
        .map((block, index) => {
            const isCardio = block.type === 'cardio'
            return {
                exercise_id: toExerciseId(block.exercise.id, index),
                name: block.exercise.name,
                sets: Math.max(1, block.config?.sets ?? 3),
                reps: isCardio ? undefined : Math.max(1, block.config?.reps ?? 10),
                duration:
                    isCardio && block.config?.duration
                        ? Math.max(1, block.config.duration * 60)
                        : undefined,
                rest_seconds: Math.max(0, block.config?.restSeconds ?? 60),
                weight:
                    block.config?.weight && block.config.weight > 0
                        ? block.config.weight
                        : undefined,
                notes: block.config?.note?.trim() || undefined,
            }
        })
