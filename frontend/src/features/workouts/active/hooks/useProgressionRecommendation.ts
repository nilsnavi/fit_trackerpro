import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { progressionApi } from '@shared/api/domains/progressionApi'
import type {
    ProgressionPolicy,
    ProgressionPolicyUpdateRequest,
    ProgressionRecommendation,
    ProgressionScopeParams,
} from '@features/workouts/types/workouts'

export type { ProgressionRecommendation }

export const progressionQueryKeys = {
    all: ['workouts', 'progression'] as const,
    recommendation: (exerciseId: number, params: ProgressionScopeParams = {}) =>
        [
            ...progressionQueryKeys.all,
            'recommendation',
            exerciseId,
            params.template_id ?? null,
            params.template_exercise_id ?? null,
        ] as const,
    legacyPreview: (exerciseId: number, policy: ProgressionPolicy) =>
        [...progressionQueryKeys.all, 'preview', exerciseId, policy] as const,
    policy: (exerciseId: number, params: ProgressionScopeParams = {}) =>
        [
            ...progressionQueryKeys.all,
            'policy',
            exerciseId,
            params.template_id ?? null,
            params.template_exercise_id ?? null,
        ] as const,
    history: (exerciseId: number, params: ProgressionScopeParams = {}) =>
        [
            ...progressionQueryKeys.all,
            'history',
            exerciseId,
            params.template_id ?? null,
            params.template_exercise_id ?? null,
        ] as const,
    /** SPEC-006 §58: accepted targets whose automatic prefill was switched off. */
    prefillList: (declinedOnly: boolean) =>
        [...progressionQueryKeys.all, 'prefill', declinedOnly] as const,
}

/**
 * SPEC-006 §41: persisted next-target recommendation for an exercise.
 *
 * Returns the backend's stored recommendation (which is what the next workout
 * pre-fills from). When nothing is stored yet the backend answers 404, and the
 * UI may fall back to the read-only preview hook below.
 */
export function useExerciseProgressionRecommendation({
    exerciseId,
    templateId,
    templateExerciseId,
    enabled = true,
}: {
    exerciseId: number
    templateId?: number | null
    templateExerciseId?: number | null
    enabled?: boolean
}) {
    const params: ProgressionScopeParams = {
        template_id: templateId ?? undefined,
        template_exercise_id: templateExerciseId ?? undefined,
    }
    return useQuery({
        queryKey: progressionQueryKeys.recommendation(exerciseId, params),
        queryFn: () => progressionApi.getExerciseRecommendation(exerciseId, params),
        enabled: enabled && exerciseId > 0,
        staleTime: 15_000,
        // 404 (nothing stored yet) is a normal state, not an error to retry.
        retry: (failureCount, error) =>
            (error as { status?: number })?.status === 404 ? false : failureCount < 1,
    })
}

/** SPEC-006 §7: effective policy for the scope (MANUAL until configured). */
export function useExerciseProgressionPolicy({
    exerciseId,
    templateId,
    templateExerciseId,
    enabled = true,
}: {
    exerciseId: number
    templateId?: number | null
    templateExerciseId?: number | null
    enabled?: boolean
}) {
    const params: ProgressionScopeParams = {
        template_id: templateId ?? undefined,
        template_exercise_id: templateExerciseId ?? undefined,
    }
    return useQuery({
        queryKey: progressionQueryKeys.policy(exerciseId, params),
        queryFn: () => progressionApi.getExercisePolicy(exerciseId, params),
        enabled: enabled && exerciseId > 0,
        staleTime: 5 * 60_000,
        retry: 1,
    })
}

export function useSaveProgressionPolicy() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            exerciseId,
            payload,
            params = {},
        }: {
            exerciseId: number
            payload: ProgressionPolicyUpdateRequest
            params?: ProgressionScopeParams
        }) => progressionApi.updateExercisePolicy(exerciseId, payload, params),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
    })
}

/**
 * SPEC-006 §42/§43: accepting the recommendation commits it as the next target.
 * Passing a different value records the recommendation as ``modified`` without
 * ever overwriting the user's choice (SPEC §64).
 */
export function useAcceptProgressionRecommendation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            recommendationId,
            selectedValue,
        }: {
            recommendationId: number
            selectedValue?: number | null
        }) => progressionApi.acceptRecommendation(recommendationId, selectedValue),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
    })
}

/** SPEC-006 §44: rejecting only changes the recommendation lifecycle. */
export function useRejectProgressionRecommendation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ recommendationId }: { recommendationId: number }) =>
            progressionApi.rejectRecommendation(recommendationId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
    })
}

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
 * SPEC-005 §36–38: read-only preview for exercises without a stored policy.
 * Kept for backward compatibility; persisted SPEC-006 recommendations take
 * precedence wherever they exist.
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
            ...progressionQueryKeys.legacyPreview(exerciseId, policy),
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
