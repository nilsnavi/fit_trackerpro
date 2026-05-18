/**
 * Workouts API Layer
 * 
 * Чистый API слой без бизнес-логики.
 * Только HTTP запросы и нормализация данных.
 */

import { api } from '@shared/api/client'
import type {
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutSessionUpdateRequest,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    CalendarWorkout,
} from '@features/workouts/types/workouts'

/**
 * Нормализация ID тренировки из ответа API
 */
function normalizeWorkoutId(response: { id?: number; workout_id?: number }): number {
    const normalizedId =
        typeof response.id === 'number'
            ? response.id
            : typeof response.workout_id === 'number'
                ? response.workout_id
                : null

    if (normalizedId == null) {
        throw new Error('Workout response does not contain valid id')
    }

    return normalizedId
}

/**
 * Нормализация элемента истории тренировок
 */
function normalizeWorkoutHistoryItem(response: WorkoutHistoryItem): WorkoutHistoryItem {
    return {
        ...response,
        id: normalizeWorkoutId(response),
    }
}

/**
 * Нормализация ответа списка истории
 */
function normalizeWorkoutHistoryResponse(response: WorkoutHistoryResponse): WorkoutHistoryResponse {
    return {
        ...response,
        items: response.items.map(normalizeWorkoutHistoryItem),
    }
}

/**
 * Workouts API - чистые HTTP операции
 */
export const workoutsApi = {
    /**
     * Получить историю тренировок с пагинацией
     */
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

    /**
     * Получить детальную информацию о тренировке
     */
    getHistoryItem(workoutId: number): Promise<WorkoutHistoryItem> {
        return api
            .get<WorkoutHistoryItem>(`/workouts/history/${workoutId}`)
            .then(normalizeWorkoutHistoryItem)
    },

    /**
     * Получить календарь тренировок за месяц
     */
    getCalendarMonth(params: { year: number; month: number }): Promise<CalendarWorkout[]> {
        return api.get<CalendarWorkout[]>('/workouts/calendar', params)
    },

    /**
     * Начать новую тренировку
     */
    startWorkout(payload: WorkoutStartRequest): Promise<WorkoutStartResponse> {
        return api.post<WorkoutStartResponse>('/workouts/start', payload)
    },

    /**
     * Завершить тренировку
     */
    completeWorkout(
        workoutId: number,
        payload: WorkoutCompleteRequest,
    ): Promise<WorkoutCompleteResponse> {
        return api.post<WorkoutCompleteResponse>(`/workouts/${workoutId}/complete`, payload)
    },

    /**
     * Обновить сессию тренировки (оптимистичные обновления)
     */
    updateWorkoutSession(
        workoutId: number,
        payload: WorkoutSessionUpdateRequest,
    ): Promise<void> {
        return api.put<void>(`/workouts/${workoutId}/session`, payload)
    },
}
