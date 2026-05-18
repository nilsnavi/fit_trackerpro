/**
 * Telegram Haptic Feedback Helper
 * 
 * Безопасный wrapper для haptic feedback в Telegram Mini App.
 * Работает как внутри Telegram, так и в обычном браузере (noop fallback).
 * 
 * @example
 * ```ts
 * import { hapticImpact, hapticNotification } from '@features/telegram/telegramHaptics'
 * 
 * // В event handler
 * const handleClick = () => {
 *   hapticImpact('light')
 *   // ... action logic
 * }
 * ```
 */

// Types for Telegram WebApp HapticFeedback
type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'error' | 'success' | 'warning'

interface HapticFeedbackAPI {
    impactOccurred: (style: ImpactStyle) => void
    notificationOccurred: (type: NotificationType) => void
    selectionChanged: () => void
}

/**
 * Проверяет доступность Telegram HapticFeedback API
 */
function getHapticFeedback(): HapticFeedbackAPI | null {
    if (typeof window === 'undefined') {
        return null
    }

    const tg = (window as any).Telegram?.WebApp
    if (!tg || !tg.HapticFeedback) {
        return null
    }

    return tg.HapticFeedback
}

/**
 * Impact feedback - тактильный отклик при взаимодействии
 * 
 * @param style - интенсивность вибрации
 * 
 * Use cases:
 * - light: выбор опции, переключение табов
 * - medium: нажатие кнопок, подтверждение действий
 * - heavy: важные действия (завершение тренировки)
 * - rigid/soft: специальные UI паттерны
 */
export function hapticImpact(style: ImpactStyle = 'medium'): void {
    const haptic = getHapticFeedback()
    if (haptic) {
        try {
            haptic.impactOccurred(style)
        } catch (e) {
            // Silent fail - не ломаем приложение если API недоступен
            console.warn('[Haptic] impactOccurred failed:', e)
        }
    }
}

/**
 * Notification feedback - уведомление о результате операции
 * 
 * @param type - тип уведомления
 * 
 * Use cases:
 * - success: успешное завершение действия
 * - error: ошибка валидации или выполнения
 * - warning: предупреждение
 */
export function hapticNotification(type: NotificationType): void {
    const haptic = getHapticFeedback()
    if (haptic) {
        try {
            haptic.notificationOccurred(type)
        } catch (e) {
            console.warn('[Haptic] notificationOccurred failed:', e)
        }
    }
}

/**
 * Selection feedback - смена выбора/состояния
 * 
 * Use cases:
 * - переключение между подходами
 * - изменение активного input
 * - toggle completed state
 */
export function hapticSelection(): void {
    const haptic = getHapticFeedback()
    if (haptic) {
        try {
            haptic.selectionChanged()
        } catch (e) {
            console.warn('[Haptic] selectionChanged failed:', e)
        }
    }
}

/**
 * Convenience aliases для常见ных сценариев
 */

// Set completion
export const hapticSetCompleted = () => hapticNotification('success')
export const hapticSetError = () => hapticNotification('error')
export const hapticSetSelection = () => hapticSelection()

// Button interactions
export const hapticButtonPress = () => hapticImpact('medium')
export const hapticButtonHeavy = () => hapticImpact('heavy')
export const hapticButtonLight = () => hapticImpact('light')

// Workout actions
export const hapticWorkoutStart = () => hapticImpact('light')
export const hapticWorkoutComplete = () => hapticNotification('success')
export const hapticWorkoutError = () => hapticNotification('error')

// Timer
export const hapticTimerSkip = () => hapticImpact('light')
export const hapticTimerEnd = () => hapticNotification('success')
