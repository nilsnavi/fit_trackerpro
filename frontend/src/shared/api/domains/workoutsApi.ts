import { api } from '@shared/api/client'
import type {
    WorkoutTemplateCreateRequest,
    WorkoutTemplateCreateFromWorkoutRequest,
    WorkoutTemplateCloneRequest,
    WorkoutTemplatePatchRequest,
    WorkoutTemplateResponse,
    WorkoutTemplateListResponse,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutSessionUpdateRequest,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    CalendarWorkout,
    WorkoutSetPatchRequest,
    WorkoutSetResponse,
    WeightRecommendationResponse,
    WorkoutSessionListItem,
    WorkoutCancelResponse,
    ProgressionRecommendation,
    ProgressionPolicy,
} from '@features/workouts/types/workouts'

function normalizeWorkoutStartResponse(response: WorkoutStartResponse): WorkoutStartResponse {
    const normalizedId =
        typeof response.id === 'number'
            ? response.id
            : typeof response.workout_id === 'number'
                ? response.workout_id
                : null

    if (normalizedId == null) {
        throw new Error('Workout start response does not contain workout id')
    }

    return {
        ...response,
        id: normalizedId,
    }
}

function toWorkoutSessionCreatePayload(payload: WorkoutStartRequest): WorkoutStartRequest {
    if (payload.source_type) {
        return payload
    }
    if (payload.template_id != null) {
        return {
            ...payload,
            source_type: 'personal_template',
            source_id: payload.template_id,
        }
    }
    return {
        ...payload,
        source_type: 'quick_start',
    }
}

function normalizeWorkoutHistoryItem(response: WorkoutHistoryItem): WorkoutHistoryItem {
    const normalizedId =
        typeof response.id === 'number'
            ? response.id
            : typeof response.workout_id === 'number'
                ? response.workout_id
                : null

    if (normalizedId == null) {
        throw new Error('Workout history response does not contain workout id')
    }

    return {
        ...response,
        id: normalizedId,
    }
}

function normalizeWorkoutHistoryResponse(response: WorkoutHistoryResponse): WorkoutHistoryResponse {
    return {
        ...response,
        items: response.items.map(normalizeWorkoutHistoryItem),
    }
}

export const workoutsApi = {
    getHistory(params?: {
        page?: number
        page_size?: number
        date_from?: string
        date_to?: string
    }): Promise<WorkoutHistoryResponse> {
        return api
            .get<WorkoutHistoryResponse>('/workouts/history', params)
            .then(normalizeWorkoutHistoryResponse)
    },

    getHistoryItem(workoutId: number): Promise<WorkoutHistoryItem> {
        return api
            .get<WorkoutHistoryItem>(`/workouts/history/${workoutId}`)
            .then(normalizeWorkoutHistoryItem)
    },

    getCalendarMonth(params: { year: number; month: number }): Promise<CalendarWorkout[]> {
        return api.get<CalendarWorkout[]>('/workouts/calendar', params)
    },

    getTemplates(params?: {
        page?: number
        page_size?: number
        template_type?: string
        include_archived?: boolean
    }): Promise<WorkoutTemplateListResponse> {
        return api.get<WorkoutTemplateListResponse>('/workouts/templates', params)
    },

    getTemplate(templateId: number): Promise<WorkoutTemplateResponse> {
        return api.get<WorkoutTemplateResponse>(`/workouts/templates/${templateId}`)
    },

    createTemplate(payload: WorkoutTemplateCreateRequest): Promise<WorkoutTemplateResponse> {
        return api.post<WorkoutTemplateResponse>('/workouts/templates', payload)
    },

    createTemplateFromWorkout(
        payload: WorkoutTemplateCreateFromWorkoutRequest,
    ): Promise<WorkoutTemplateResponse> {
        return api.post<WorkoutTemplateResponse>('/workouts/templates/from-workout', payload)
    },

    updateTemplate(
        templateId: number,
        payload: WorkoutTemplateCreateRequest,
    ): Promise<WorkoutTemplateResponse> {
        return api.put<WorkoutTemplateResponse>(`/workouts/templates/${templateId}`, payload)
    },

    patchTemplate(
        templateId: number,
        payload: WorkoutTemplatePatchRequest,
    ): Promise<WorkoutTemplateResponse> {
        return api.patch<WorkoutTemplateResponse>(`/workouts/templates/${templateId}`, payload)
    },

    cloneTemplate(
        templateId: number,
        payload: WorkoutTemplateCloneRequest = {},
    ): Promise<WorkoutTemplateResponse> {
        return api.post<WorkoutTemplateResponse>(`/workouts/templates/${templateId}/clone`, payload)
    },

    deleteTemplate(templateId: number): Promise<void> {
        return api.delete<void>(`/workouts/templates/${templateId}`)
    },

    archiveTemplate(templateId: number): Promise<WorkoutTemplateResponse> {
        return api.post<WorkoutTemplateResponse>(`/workouts/templates/${templateId}/archive`)
    },

    unarchiveTemplate(templateId: number): Promise<WorkoutTemplateResponse> {
        return api.post<WorkoutTemplateResponse>(`/workouts/templates/${templateId}/unarchive`)
    },

    updateWorkoutSession(
        workoutId: number,
        payload: WorkoutSessionUpdateRequest,
    ): Promise<WorkoutHistoryItem> {
        return api
            .patch<WorkoutHistoryItem>(`/workouts/history/${workoutId}`, payload)
            .then(normalizeWorkoutHistoryItem)
    },

    startWorkout(payload: WorkoutStartRequest): Promise<WorkoutStartResponse> {
        return api
            .post<WorkoutStartResponse>('/workouts/sessions', toWorkoutSessionCreatePayload(payload))
            .then(normalizeWorkoutStartResponse)
    },

    completeWorkout(
        workoutId: number,
        payload: WorkoutCompleteRequest,
    ): Promise<WorkoutCompleteResponse> {
        return api.post<WorkoutCompleteResponse>(
            `/workouts/complete?workout_id=${workoutId}`,
            payload,
        )
    },

    patchWorkoutSet(
        workoutId: number,
        setId: number,
        payload: WorkoutSetPatchRequest,
    ): Promise<WorkoutSetResponse> {
        return api.patch<WorkoutSetResponse>(
            `/workouts/${workoutId}/sets/${setId}`,
            payload,
        )
    },

    getWeightRecommendation(
        sessionId: number,
        exerciseId: number,
    ): Promise<WeightRecommendationResponse> {
        return api.get<WeightRecommendationResponse>(
            `/workouts/sessions/${sessionId}/exercises/${exerciseId}/weight-recommendation`,
        )
    },

    // ─── SPEC-005 ────────────────────────────────────────────────────────────

    /** SPEC-005 §48: incomplete sessions for the restore prompt. */
    listIncompleteSessions(): Promise<WorkoutSessionListItem[]> {
        return api.get<WorkoutSessionListItem[]>('/workouts/sessions/incomplete')
    },

    /** SPEC-005 §3: cancel an in-progress session. */
    cancelWorkout(
        workoutId: number,
        payload: { comments?: string; idempotency_key?: string } = {},
    ): Promise<WorkoutCancelResponse> {
        return api.post<WorkoutCancelResponse>(`/workouts/${workoutId}/cancel`, payload)
    },

    /** SPEC-005 §37–38: explainable progression recommendation. */
    getProgressionRecommendation(params: {
        exercise_id: number
        policy?: ProgressionPolicy
        increment?: number
        rep_range_min?: number
        rep_range_max?: number
        target_rpe?: number
        target_rir?: number
        percent_1rm?: number
        time_increment_seconds?: number
    }): Promise<ProgressionRecommendation> {
        return api.get<ProgressionRecommendation>('/workouts/progression/recommendation', params)
    },

}
