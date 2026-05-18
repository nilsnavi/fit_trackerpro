/**
 * useIncompleteWorkoutCheck Hook
 * 
 * Проверяет наличие незавершенной тренировки при старте приложения
 * и предлагает пользователю восстановить её.
 */

import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { toast } from '@shared/stores/toastStore'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'

export function useIncompleteWorkoutCheck() {
    const navigate = useNavigate()
    const draft = useActiveWorkoutSessionDraftStore((s) => s.draft)
    const clearDraft = useActiveWorkoutSessionDraftStore((s) => s.clearDraft)

    const checkAndRestore = useCallback(async () => {
        // Проверяем есть ли draft в localStorage
        if (!draft || !draft.workoutId) {
            return
        }

        try {
            // Проверяем существует ли еще эта тренировка на сервере
            const workout = await workoutsApi.getHistoryItem(draft.workoutId)
            
            // Если тренировка завершена (есть duration), очищаем draft
            if (workout.duration && workout.duration > 0) {
                clearDraft()
                return
            }

            // Тренировка активна - показываем уведомление
            const shouldRestore = confirm(
                `У вас есть незавершенная тренировка "${workout.comments || 'Без названия'}".\n\n` +
                `Продолжить с места остановки?`
            )

            if (shouldRestore) {
                // Навигируем к активной тренировке
                navigate(`/workouts/active/${draft.workoutId}`, { replace: true })
                
                toast.success('Тренировка восстановлена')
            } else {
                // Пользователь отказался - очищаем draft
                clearDraft()
            }
        } catch (error) {
            // Тренировка не найдена или ошибка сети - очищаем draft
            console.error('Failed to check incomplete workout:', error)
            clearDraft()
        }
    }, [draft, navigate, clearDraft])

    // Проверяем при монтировании (только один раз)
    useEffect(() => {
        checkAndRestore()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return {
        hasIncompleteWorkout: !!draft?.workoutId,
        checkAndRestore,
    }
}
