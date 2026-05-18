/**
 * useQuickStartWorkout Hook
 * 
 * Создает новую тренировку без шаблона (quick_start).
 * Пользователь сразу попадает в ActiveWorkoutPage с пустой сессией.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStartWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import type { WorkoutStartRequest } from '@features/workouts/types/workouts'

export function useQuickStartWorkout() {
    const navigate = useNavigate()
    const startWorkoutMutation = useStartWorkoutMutation()

    const quickStart = useCallback(() => {
        const payload: WorkoutStartRequest = {
            source_type: 'quick_start' as const,
            name: 'Быстрая тренировка',
            type: 'custom' as const,
        }

        startWorkoutMutation.mutate(payload, {
            onSuccess: (response) => {
                // Навигируем к активной тренировке
                navigate(`/workouts/active/${response.id}`, { replace: true })
            },
            onError: (error) => {
                console.error('Quick start failed:', error)
            },
        })
    }, [navigate, startWorkoutMutation])

    return {
        quickStart,
        isLoading: startWorkoutMutation.isPending,
    }
}
