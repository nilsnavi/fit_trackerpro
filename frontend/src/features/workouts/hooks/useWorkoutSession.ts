/**
 * useWorkoutSession Hook
 * 
 * Хук высокого уровня для управления всей сессией тренировки.
 * Комбинирует useActiveWorkout, useRestTimer и другую логику.
 */

import { useCallback, useEffect } from 'react'
import { useActiveWorkout } from './useActiveWorkout'
import { useRestTimer } from './useRestTimer'
import type { WorkoutCompleteRequest, CompletedExercise } from '@features/workouts/types/workouts'

interface UseWorkoutSessionParams {
    workoutId: number
    defaultRestSeconds?: number
    onWorkoutComplete?: () => void
}

export function useWorkoutSession({
    workoutId,
    defaultRestSeconds = 90,
    onWorkoutComplete,
}: UseWorkoutSessionParams) {
    // Основная логика активной тренировки
    const {
        sessionState,
        initialize,
        complete,
        updateSets,
        incrementDuration,
        resetSession,
        isCompleting,
        isUpdating,
        error,
    } = useActiveWorkout({ workoutId })

    // Таймер отдыха между подходами
    const restTimer = useRestTimer({
        initialSeconds: defaultRestSeconds,
        onComplete: () => {
            // Авто-переход к следующему подходу после отдыха
            console.log('Rest timer completed')
        },
    })

    // Инициализация при монтировании
    useEffect(() => {
        initialize()
        
        return () => {
            resetSession()
        }
    }, [workoutId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Добавление упражнения
    const addExercise = useCallback((exercise: Omit<CompletedExercise, 'sets_completed'>) => {
        // TODO: интегрировать с Zustand store
        console.log('Add exercise:', exercise)
    }, [])

    // Завершение подхода с запуском таймера отдыха
    const completeSet = useCallback(
        (exerciseIndex: number, _setIndex: number) => {
            // Обновляем подход
            updateSets(exerciseIndex, []) // TODO: передать обновленные подходы
            
            // Запускаем таймер отдыха
            restTimer.start(defaultRestSeconds)
        },
        [updateSets, restTimer, defaultRestSeconds],
    )

    // Пропуск отдыха
    const skipRest = useCallback(() => {
        restTimer.skip()
    }, [restTimer])

    // Завершение тренировки
    const finishWorkout = useCallback(
        (payload: WorkoutCompleteRequest) => {
            complete(payload)
            onWorkoutComplete?.()
        },
        [complete, onWorkoutComplete],
    )

    return {
        // Session state
        workoutId: sessionState.workoutId,
        isActive: sessionState.isActive,
        exercises: sessionState.exercises,
        currentExerciseIndex: sessionState.currentExerciseIndex,
        totalSetsCompleted: sessionState.totalSetsCompleted,
        totalDurationSeconds: sessionState.totalDurationSeconds,
        
        // Rest timer
        restTimer,
        
        // Actions
        addExercise,
        completeSet,
        skipRest,
        finishWorkout,
        incrementDuration,
        
        // Loading states
        isCompleting,
        isUpdating,
        error,
    }
}
