import { api } from '@shared/api/client'
import type {
    WorkoutTemplateCreateRequest,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
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

    createTemplate(payload: WorkoutTemplateCreateRequest) {
        return api.post('/workouts/templates', payload)
    },

    startWorkout(payload: WorkoutStartRequest): Promise<WorkoutStartResponse> {
        return api.post<WorkoutStartResponse>('/workouts/start', payload)
    },

    completeWorkout(workoutId: number, payload: WorkoutCompleteRequest) {
        return api.post(`/workouts/complete?workout_id=${workoutId}`, payload)
    },
}
