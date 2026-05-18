/**
 * useTelegramMiniApp Hook
 * 
 * Интеграция с Telegram Mini App API.
 * Обеспечивает safe area, haptic feedback, back button handling.
 */

import { useEffect, useCallback } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

export function useTelegramMiniApp() {
    const tg = useTelegramWebApp()

    // Инициализация safe area
    useEffect(() => {
        if (!tg.isTelegram) return

        // Включаем подтверждение закрытия
        tg.enableClosingConfirmation?.()
        
        // Устанавливаем цвета header под тему
        const isDark = tg.colorScheme === 'dark'
        tg.setHeaderColor?.(isDark ? '#1c1c1e' : '#ffffff')
        tg.setBackgroundColor?.(isDark ? '#000000' : '#ffffff')
    }, [tg])

    // Haptic feedback helpers - используем существующий метод из useTelegramWebApp
    const hapticImpact = useCallback(
        (type: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
            tg.hapticFeedback({ type: 'impact', style: type })
        },
        [tg],
    )

    const hapticNotification = useCallback(
        (type: 'error' | 'success' | 'warning') => {
            tg.hapticFeedback({ type: 'notification', notificationType: type })
        },
        [tg],
    )

    const hapticSelection = useCallback(() => {
        tg.hapticFeedback({ type: 'selection' })
    }, [tg])

    // Back button handler
    const enableBackButton = useCallback(
        (onBack: () => void) => {
            if (!tg.isTelegram) return

            tg.showBackButton(onBack)

            return () => {
                tg.hideBackButton()
            }
        },
        [tg],
    )

    // Expand to full height
    const expandView = useCallback(() => {
        tg.expand?.()
    }, [tg])

    return {
        tg,
        hapticImpact,
        hapticNotification,
        hapticSelection,
        enableBackButton,
        expandView,
    }
}
