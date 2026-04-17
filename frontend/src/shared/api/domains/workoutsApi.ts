import { api } from '@shared/api/client'
import type {
    WorkoutTemplateCreateRequest,
    WorkoutTemplateCreateFromWorkoutRequest,
    WorkoutTemplateCloneRequest,
    WorkoutTemplatePatchRequest,
    WorkoutTemplateResponse,
    WorkoutTemplateListResponse,
    WorkoutStartRequest,
    WorkoutStartFromTemplateRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutSessionUpdateRequest,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    CalendarWorkout,
    WorkoutSetPatchRequest,
    WorkoutSetResponse,
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
            .post<WorkoutStartResponse>('/workouts/start', payload)
            .then(normalizeWorkoutStartResponse)
    },

    startWorkoutFromTemplateWithOverrides(
        templateId: number,
        payload: WorkoutStartFromTemplateRequest,
    ): Promise<WorkoutStartResponse> {
        return api
            .post<WorkoutStartResponse>(`/workouts/start/from-template/${templateId}`, payload)
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
}
