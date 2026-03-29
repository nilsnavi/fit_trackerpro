import { api } from '@shared/api/client'
import type {
    WorkoutTemplateCreateRequest,
    WorkoutTemplateResponse,
    WorkoutTemplateListResponse,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
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
    }): Promise<WorkoutTemplateListResponse> {
        return api.get<WorkoutTemplateListResponse>('/workouts/templates', params)
    },

    createTemplate(payload: WorkoutTemplateCreateRequest): Promise<WorkoutTemplateResponse> {
        return api.post<WorkoutTemplateResponse>('/workouts/templates', payload)
    },

    updateTemplate(
        templateId: number,
        payload: WorkoutTemplateCreateRequest,
    ): Promise<WorkoutTemplateResponse> {
        return api.put<WorkoutTemplateResponse>(`/workouts/templates/${templateId}`, payload)
    },

    startWorkout(payload: WorkoutStartRequest): Promise<WorkoutStartResponse> {
        return api.post<WorkoutStartResponse>('/workouts/start', payload)
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
