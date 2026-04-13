import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'

export type ExerciseSessionStatus = 'pending' | 'current' | 'done'

export type ExerciseSessionState = {
    exerciseId: string
    status: ExerciseSessionStatus
    completedSets: number
    totalSets: number
    sets: Array<{
        reps: number
        weight: number
        skipped: boolean
    }>
}

function setProcessed(set: CompletedSet, exerciseIndex: number, setIndex: number, currentExerciseIndex: number, currentSetIndex: number): boolean {
    if (set.completed) return true
    if (exerciseIndex < currentExerciseIndex) return true
    if (exerciseIndex === currentExerciseIndex && setIndex < currentSetIndex) return true
    return false
}

export function deriveExerciseSessionState(
    exercise: CompletedExercise,
    exerciseIndex: number,
    currentExerciseIndex: number,
    currentSetIndex: number,
): ExerciseSessionState {
    const totalSets = exercise.sets_completed.length
    const sets = exercise.sets_completed.map((s, setIndex) => ({
        reps: typeof s.reps === 'number' ? s.reps : 0,
        weight: typeof s.weight === 'number' ? s.weight : 0,
        skipped: !s.completed && setProcessed(s, exerciseIndex, setIndex, currentExerciseIndex, currentSetIndex),
    }))

    const completedSets = exercise.sets_completed.filter((s, i) =>
        setProcessed(s, exerciseIndex, i, currentExerciseIndex, currentSetIndex),
    ).length

    let status: ExerciseSessionStatus
    if (exerciseIndex < currentExerciseIndex) {
        status = 'done'
    } else if (exerciseIndex > currentExerciseIndex) {
        status = 'pending'
    } else {
        const allDone = exercise.sets_completed.every((s, i) => setProcessed(s, exerciseIndex, i, currentExerciseIndex, currentSetIndex))
        status = allDone ? 'done' : 'current'
    }

    return {
        exerciseId: `${exercise.exercise_id}-${exerciseIndex}`,
        status,
        completedSets,
        totalSets,
        sets,
    }
}

export function countExercisesDone(
    exercises: CompletedExercise[],
    currentExerciseIndex: number,
    currentSetIndex: number,
): number {
    return exercises.reduce((acc, ex, i) => {
        const st = deriveExerciseSessionState(ex, i, currentExerciseIndex, currentSetIndex)
        return acc + (st.status === 'done' ? 1 : 0)
    }, 0)
}
