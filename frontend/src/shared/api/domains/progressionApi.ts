import { api } from '@shared/api/client'
import type {
    ProgressionBulkResult,
    ProgressionPolicyConfig,
    ProgressionPolicyUpdateRequest,
    ProgressionPrefillList,
    ProgressionPrefillSweepList,
    ProgressionRecommendation,
    ProgressionScopeParams,
    ProgressionTargetBulkUpdateRequest,
    ProgressionTargetUpdateRequest,
} from '@features/workouts/types/workouts'

/**
 * SPEC-006 Progression Engine API.
 *
 * The backend is the source of truth: recommendations are persisted there and
 * only an explicit accept/modify updates the user's next target.
 */
export const progressionApi = {
    getExercisePolicy(
        exerciseId: number,
        params: ProgressionScopeParams = {},
    ): Promise<ProgressionPolicyConfig> {
        return api.get<ProgressionPolicyConfig>(
            `/progression/exercises/${exerciseId}`,
            params,
        )
    },

    updateExercisePolicy(
        exerciseId: number,
        payload: ProgressionPolicyUpdateRequest,
        params: ProgressionScopeParams = {},
    ): Promise<ProgressionPolicyConfig> {
        return api.put<ProgressionPolicyConfig>(
            `/progression/exercises/${exerciseId}`,
            payload,
            params,
        )
    },

    getExerciseRecommendation(
        exerciseId: number,
        params: ProgressionScopeParams = {},
    ): Promise<ProgressionRecommendation> {
        return api.get<ProgressionRecommendation>(
            `/progression/exercises/${exerciseId}/recommendation`,
            params,
        )
    },

    getExerciseHistory(
        exerciseId: number,
        params: ProgressionScopeParams = {},
    ): Promise<ProgressionRecommendation[]> {
        return api.get<ProgressionRecommendation[]>(
            `/progression/exercises/${exerciseId}/history`,
            params,
        )
    },

    acceptRecommendation(
        recommendationId: number,
        selectedValue?: number | null,
    ): Promise<ProgressionRecommendation> {
        return api.post<ProgressionRecommendation>(
            `/progression/recommendations/${recommendationId}/accept`,
            selectedValue == null ? {} : { selected_value: selectedValue },
        )
    },

    rejectRecommendation(recommendationId: number): Promise<ProgressionRecommendation> {
        return api.post<ProgressionRecommendation>(
            `/progression/recommendations/${recommendationId}/reject`,
            {},
        )
    },

    /** SPEC-006 §58: accepted targets and whether they prefill new sessions. */
    listPrefillTargets(
        params: { declined_only?: boolean; limit?: number } = {},
    ): Promise<ProgressionPrefillList> {
        return api.get<ProgressionPrefillList>('/progression/prefill', params)
    },

    /**
     * SPEC-006 §58: the bulk switch-offs that can still be undone, newest first.
     *
     * Resolved server-side from the sweeps the targets were declined by, so an
     * undo survives a reload and is offered on any device — instead of depending
     * on a copy the browser had to keep — and a run of sweeps can be put back in
     * any order, not only the newest one.
     */
    listPrefillSweeps(limit?: number): Promise<ProgressionPrefillSweepList> {
        return api.get<ProgressionPrefillSweepList>(
            '/progression/prefill/sweeps',
            limit == null ? {} : { limit },
        )
    },

    /** SPEC-006 §58: turns the automatic prefill of one target back on. */
    enablePrefill(recommendationId: number): Promise<ProgressionRecommendation> {
        return api.post<ProgressionRecommendation>(
            `/progression/prefill/${recommendationId}/enable`,
            {},
        )
    },

    /** SPEC-006 §58: stops prefilling one target automatically (it stays accepted). */
    disablePrefill(recommendationId: number): Promise<ProgressionRecommendation> {
        return api.post<ProgressionRecommendation>(
            `/progression/prefill/${recommendationId}/disable`,
            {},
        )
    },

    /**
     * SPEC-006 §58: stops prefilling many targets at once. Omitting the ids
     * switches every current target off — the rows the screen lists.
     */
    bulkDisablePrefill(recommendationIds?: number[] | null): Promise<ProgressionBulkResult> {
        return api.post<ProgressionBulkResult>(
            '/progression/prefill/bulk-disable',
            recommendationIds == null ? {} : { recommendation_ids: recommendationIds },
        )
    },

    /**
     * SPEC-006 §58: switches the prefill back on — the undo of a bulk switch-off.
     *
     * Addressed either to the exact targets one action changed or to whole sweeps,
     * never both. The sweep address is what the journal uses: the server resolves
     * what each sweep still holds, so one link (or the whole chain) is undone
     * without the client re-stating a set of ids it merely read.
     */
    bulkEnablePrefill(payload: {
        recommendationIds?: number[]
        sweepIds?: string[]
    }): Promise<ProgressionBulkResult> {
        return api.post<ProgressionBulkResult>('/progression/prefill/bulk-enable', {
            ...(payload.recommendationIds == null
                ? {}
                : { recommendation_ids: payload.recommendationIds }),
            ...(payload.sweepIds == null ? {} : { sweep_ids: payload.sweepIds }),
        })
    },

    /**
     * SPEC-006 §58: applies one policy / rep-range edit to several targets.
     * Values and prefill switches stay per-target decisions.
     */
    bulkUpdateTargets(
        payload: ProgressionTargetBulkUpdateRequest,
    ): Promise<ProgressionBulkResult> {
        return api.post<ProgressionBulkResult>('/progression/prefill/bulk-update', payload)
    },

    /**
     * SPEC-006 §58: edits the target itself — its value, its policy and/or its
     * rep range. Only the fields sent are written.
     */
    updateTarget(
        recommendationId: number,
        payload: ProgressionTargetUpdateRequest,
    ): Promise<ProgressionRecommendation> {
        return api.patch<ProgressionRecommendation>(
            `/progression/prefill/${recommendationId}`,
            payload,
        )
    },
}
