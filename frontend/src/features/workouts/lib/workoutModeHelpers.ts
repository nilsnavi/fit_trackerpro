import type { CompletedExercise, WorkoutHistoryItem, WorkoutSessionUpdateRequest } from '../types/workouts'

/** Сбрасывает флаги выполнения подходов (для повтора прошлой тренировки). */
export const buildRepeatExercises = (exercises: CompletedExercise[]): CompletedExercise[] =>
    exercises.map((exercise) => ({
        ...exercise,
        sets_completed: exercise.sets_completed.map((setItem) => ({
            ...setItem,
            completed: false,
            rpe: undefined,
            rir: undefined,
        })),
    }))

/** Строит payload для повтора тренировки заново (сбрасывает глюкозу и выполнение). */
export const buildRepeatSessionPayload = (
    workout: WorkoutHistoryItem,
): WorkoutSessionUpdateRequest => ({
    exercises: buildRepeatExercises(workout.exercises),
    comments: workout.comments,
    tags: workout.tags ?? [],
    glucose_before: undefined,
    glucose_after: undefined,
})
