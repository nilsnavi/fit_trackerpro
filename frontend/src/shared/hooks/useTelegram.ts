/**
 * useTelegram hook - Мок-реализация для автономного использования в браузере
 * 
 * Этот хук предоставляет заглушки, которые работают вне среды Telegram.
 * При запуске внутри Telegram Mini App пытается использовать реальные API Telegram.
 */

import { useCallback } from 'react'

interface TelegramUser {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    photo_url?: string
}

interface UseTelegramReturn {
    sdk: null
    initData: null
    user: TelegramUser | null
    hapticFeedback: {
        light: () => void
        medium: () => void
        heavy: () => void
        success: () => void
        error: () => void
        selectionChanged: () => void
    }
    showMainButton: (text: string, onClick: () => void) => void
    hideMainButton: () => void
    ready: boolean
}

export function useTelegram(): UseTelegramReturn {
    // Haptic feedback - использует API Telegram, если доступно, иначе нет-оп
    const hapticFeedback = {
        light: useCallback(() => {
            try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
            } catch {
                // Нет-оп вне Telegram
            }
        }, []),
        medium: useCallback(() => {
            try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
            } catch {
                // Нет-оп вне Telegram
            }
        }, []),
        heavy: useCallback(() => {
            try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy')
            } catch {
                // Нет-оп вне Telegram
            }
        }, []),
        success: useCallback(() => {
            try {
                window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
            } catch {
                // Нет-оп вне Telegram
            }
        }, []),
        error: useCallback(() => {
            try {
                window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error')
            } catch {
                // Нет-оп вне Telegram
            }
        }, []),
        selectionChanged: useCallback(() => {
            try {
                window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()
            } catch {
                // Нет-оп вне Telegram
            }
        }, []),
    }

    // Главная кнопка - использует API Telegram, если доступно, иначе лог в консоль
    const showMainButton = useCallback((text: string, onClick: () => void) => {
        try {
            const tg = window.Telegram?.WebApp
            if (tg?.MainButton) {
                tg.MainButton.setText(text)
                tg.MainButton.onClick(onClick)
                tg.MainButton.show()
            } else {
                console.log('[Telegram Mock] MainButton shown:', text)
            }
        } catch {
            console.log('[Telegram Mock] MainButton shown:', text)
        }
    }, [])

    const hideMainButton = useCallback(() => {
        try {
            window.Telegram?.WebApp?.MainButton?.hide()
        } catch {
            // Нет-оп вне Telegram
        }
    }, [])

    return {
        sdk: null,
        initData: null,
        user: null,
        hapticFeedback,
        showMainButton,
        hideMainButton,
        ready: true, // Всегда готов в автономном режиме
    }
}
