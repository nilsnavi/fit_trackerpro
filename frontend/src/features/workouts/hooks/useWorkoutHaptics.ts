/**
 * useWorkoutHaptics Hook
 * 
 * Предоставляет haptic feedback для ключевых действий в тренировке.
 * Использует Telegram WebApp API когда доступно, fallback на вибрацию браузера.
 */

import { useCallback } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

export function useWorkoutHaptics() {
    const tg = useTelegramWebApp()

    // Легкая вибрация - отметка подхода
    const hapticSetCompleted = useCallback(() => {
        if (tg?.hapticFeedback) {
            tg.hapticFeedback({ type: 'impact', style: 'light' })
        } else if (navigator.vibrate) {
            navigator.vibrate(10)
        }
    }, [tg])

    // Средняя вибрация - завершение упражнения
    const hapticExerciseCompleted = useCallback(() => {
        if (tg?.hapticFeedback) {
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
        } else if (navigator.vibrate) {
            navigator.vibrate([20, 30, 20])
        }
    }, [tg])

    // Сильная вибрация - завершение тренировки
    const hapticWorkoutCompleted = useCallback(() => {
        if (tg?.hapticFeedback) {
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
        } else if (navigator.vibrate) {
            navigator.vibrate([50, 100, 50, 100, 50])
        }
    }, [tg])

    // Ошибка/предупреждение
    const hapticError = useCallback(() => {
        if (tg?.hapticFeedback) {
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
        } else if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100])
        }
    }, [tg])

    // Таймер отдыха закончился
    const hapticRestTimerEnd = useCallback(() => {
        if (tg?.hapticFeedback) {
            tg.hapticFeedback({ type: 'notification', notificationType: 'warning' })
        } else if (navigator.vibrate) {
            navigator.vibrate([30, 50, 30, 50, 30])
        }
    }, [tg])

    return {
        hapticSetCompleted,
        hapticExerciseCompleted,
        hapticWorkoutCompleted,
        hapticError,
        hapticRestTimerEnd,
    }
}
