import { api } from '@shared/api/client'
import type {
    ProgressionPolicyConfig,
    ProgressionPolicyUpdateRequest,
    ProgressionRecommendation,
    ProgressionScopeParams,
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
}
