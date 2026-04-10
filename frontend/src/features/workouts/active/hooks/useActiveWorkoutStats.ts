import { useMemo } from 'react'
import type { CompletedExercise, WorkoutHistoryItem } from '@features/workouts/types/workouts'

export interface UseActiveWorkoutStatsParams {
    workout: WorkoutHistoryItem | undefined
}

export interface UseActiveWorkoutStatsResult {
    exerciseCount: number
    completedSetCount: number
    totalSetCount: number
    completedExercises: CompletedExercise[]
}

export function useActiveWorkoutStats({ workout }: UseActiveWorkoutStatsParams): UseActiveWorkoutStatsResult {
    const exerciseCount = useMemo(() => workout?.exercises.length ?? 0, [workout])

    const completedSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => (
            acc + exercise.sets_completed.filter((set) => set.completed).length
        ), 0)
    }, [workout])

    const totalSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => acc + exercise.sets_completed.length, 0)
    }, [workout])

    const completedExercises = useMemo(() => {
        if (!workout) return []
        return workout.exercises.filter((exercise) => exercise.sets_completed.some((set) => set.completed))
    }, [workout])

    return {
        exerciseCount,
        completedSetCount,
        totalSetCount,
        completedExercises,
    }
}

