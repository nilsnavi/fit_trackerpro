/**
 * useActiveWorkout Hook
 * 
 * Хук для управления активной тренировкой.
 * Комбинирует React Query (server state) и Zustand (session state).
 */

import { useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '../api/workouts.api'
import { useWorkoutSessionStore } from '../store/workoutSession.store'
import type { WorkoutCompleteRequest, WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

interface UseActiveWorkoutParams {
    workoutId: number
}

export function useActiveWorkout({ workoutId }: UseActiveWorkoutParams) {
    const queryClient = useQueryClient()
    
    // Zustand store для session state
    const {
        startWorkout,
        completeWorkout: completeSession,
        updateExerciseSets,
        incrementDuration,
        reset: resetSession,
    } = useWorkoutSessionStore()

    // Мутация для завершения тренировки
    const completeMutation = useMutation({
        mutationFn: (payload: WorkoutCompleteRequest) =>
            workoutsApi.completeWorkout(workoutId, payload),
        onSuccess: () => {
            // Инвалидируем кеш истории тренировок
            queryClient.invalidateQueries({ queryKey: queryKeys.workouts.history({ page: 1, page_size: 20 }) })
            queryClient.invalidateQueries({ queryKey: queryKeys.workouts.historyItem(workoutId) })
            
            // Завершаем сессию
            completeSession()
        },
    })

    // Мутация для обновления сессии (оптимистичное обновление)
    const updateSessionMutation = useMutation({
        mutationFn: (payload: WorkoutSessionUpdateRequest) =>
            workoutsApi.updateWorkoutSession(workoutId, payload),
        onError: () => {
            // В случае ошибки можно откатить оптимистичные изменения
            console.error('Failed to update workout session')
        },
    })

    // Инициализация тренировки
    const initialize = useCallback(() => {
        startWorkout(workoutId)
    }, [workoutId, startWorkout])

    // Завершение тренировки
    const complete = useCallback(
        (payload: WorkoutCompleteRequest) => {
            completeMutation.mutate(payload)
        },
        [completeMutation],
    )

    // Обновление подходов упражнения
    const updateSets = useCallback(
        (exerciseIndex: number, sets: any[]) => {
            updateExerciseSets(exerciseIndex, sets)
            
            // Отправляем обновление на сервер (debounced)
            // TODO: добавить debounce логику
        },
        [updateExerciseSets],
    )

    // Очистка при размонтировании
    useEffect(() => {
        return () => {
            // Можно добавить автосохранение перед уходом
        }
    }, [])

    return {
        // State из Zustand
        sessionState: useWorkoutSessionStore.getState(),
        
        // Actions
        initialize,
        complete,
        updateSets,
        incrementDuration,
        resetSession,
        
        // Mutation state
        isCompleting: completeMutation.isPending,
        isUpdating: updateSessionMutation.isPending,
        error: completeMutation.error || updateSessionMutation.error,
    }
}
