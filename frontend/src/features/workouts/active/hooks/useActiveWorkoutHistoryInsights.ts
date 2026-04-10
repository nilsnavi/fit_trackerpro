import { useMemo } from 'react'
import type { CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'

export interface UseActiveWorkoutHistoryInsightsParams {
    workout: WorkoutHistoryItem | undefined
    historyItems: WorkoutHistoryItem[] | undefined
}

export interface UseActiveWorkoutHistoryInsightsResult {
    repeatSource: WorkoutHistoryItem | null
    previousBestByExercise: Map<string, CompletedSet>
}

export function useActiveWorkoutHistoryInsights({
    workout,
    historyItems,
}: UseActiveWorkoutHistoryInsightsParams): UseActiveWorkoutHistoryInsightsResult {
    const repeatSource = useMemo(() => {
        if (!workout) return null
        const title = workout.comments?.trim() ?? ''
        if (!title) return null
        const items = historyItems ?? []
        return items.find((item) => item.id !== workout.id && item.comments?.trim() === title) ?? null
    }, [historyItems, workout])

    const previousBestByExercise = useMemo(() => {
        const items = historyItems ?? []
        const result = new Map<string, CompletedSet>()

        items
            .filter((item) => item.id !== workout?.id)
            .forEach((item) => {
                item.exercises.forEach((exercise) => {
                    exercise.sets_completed.forEach((set) => {
                        const current = result.get(exercise.name)
                        if (!current) {
                            result.set(exercise.name, set)
                            return
                        }

                        const nextWeight = set.weight ?? 0
                        const currentWeight = current.weight ?? 0
                        const nextReps = set.reps ?? 0
                        const currentReps = current.reps ?? 0
                        const nextDuration = set.duration ?? 0
                        const currentDuration = current.duration ?? 0
                        const nextDistance = set.distance ?? 0
                        const currentDistance = current.distance ?? 0

                        const isBetter =
                            nextWeight > currentWeight ||
                            (nextWeight === currentWeight && nextReps > currentReps) ||
                            (nextWeight === currentWeight && nextReps === currentReps && nextDuration > currentDuration) ||
                            (nextWeight === currentWeight &&
                                nextReps === currentReps &&
                                nextDuration === currentDuration &&
                                nextDistance > currentDistance)

                        if (isBetter) {
                            result.set(exercise.name, set)
                        }
                    })
                })
            })

        return result
    }, [historyItems, workout?.id])

    return { repeatSource, previousBestByExercise }
}

