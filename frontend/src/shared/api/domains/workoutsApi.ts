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
} from '@features/workouts/types/workouts'

export const workoutsApi = {
    getHistory(params?: {
        page?: number
        page_size?: number
        date_from?: string
        date_to?: string
    }): Promise<WorkoutHistoryResponse> {
        return api.get<WorkoutHistoryResponse>('/workouts/history', params)
    },

    getHistoryItem(workoutId: number): Promise<WorkoutHistoryItem> {
        return api.get<WorkoutHistoryItem>(`/workouts/history/${workoutId}`)
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
        return api.patch<WorkoutHistoryItem>(`/workouts/history/${workoutId}`, payload)
    },

    startWorkout(payload: WorkoutStartRequest): Promise<WorkoutStartResponse> {
        return api.post<WorkoutStartResponse>('/workouts/start', payload)
    },

    startWorkoutFromTemplateWithOverrides(
        templateId: number,
        payload: WorkoutStartFromTemplateRequest,
    ): Promise<WorkoutStartResponse> {
        return api.post<WorkoutStartResponse>(`/workouts/start/from-template/${templateId}`, payload)
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
}
