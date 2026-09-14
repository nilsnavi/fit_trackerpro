import { useQuery } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import type {
    ProgressionPolicy,
    ProgressionRecommendation,
} from '@features/workouts/types/workouts'

export type { ProgressionRecommendation }

interface UseProgressionRecommendationParams {
    exerciseId: number
    policy?: ProgressionPolicy
    increment?: number
    repRangeMin?: number
    repRangeMax?: number
    targetRpe?: number
    targetRir?: number
    percent1rm?: number
    timeIncrementSeconds?: number
    /** Fetch only during an active session. */
    enabled?: boolean
}

/**
 * SPEC-005 §36–38: explainable progression recommendation for an exercise.
 * The UI must always show reason + previous value + policy next to the number.
 */
export function useProgressionRecommendation({
    exerciseId,
    policy = 'DOUBLE_PROGRESSION',
    increment,
    repRangeMin,
    repRangeMax,
    targetRpe,
    targetRir,
    percent1rm,
    timeIncrementSeconds,
    enabled = true,
}: UseProgressionRecommendationParams) {
    return useQuery({
        queryKey: [
            'workouts',
            'progression-recommendation',
            exerciseId,
            policy,
            increment ?? null,
            repRangeMin ?? null,
            repRangeMax ?? null,
            targetRpe ?? null,
            targetRir ?? null,
            percent1rm ?? null,
            timeIncrementSeconds ?? null,
        ],
        queryFn: () =>
            workoutsApi.getProgressionRecommendation({
                exercise_id: exerciseId,
                policy,
                increment,
                rep_range_min: repRangeMin,
                rep_range_max: repRangeMax,
                target_rpe: targetRpe,
                target_rir: targetRir,
                percent_1rm: percent1rm,
                time_increment_seconds: timeIncrementSeconds,
            }),
        enabled: enabled && exerciseId > 0,
        staleTime: 30_000,
        retry: 1,
    })
}
