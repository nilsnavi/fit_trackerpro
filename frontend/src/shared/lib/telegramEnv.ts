import type { WebApp } from '@shared/types/telegram'

/**
 * Синхронное чтение глобального WebApp (скрипт из index.html).
 * В SSR/window отсутствует — возвращаем null.
 */
export function getTelegramWebAppFromWindow(): WebApp | null {
    if (typeof window === 'undefined') return null
    return window.Telegram?.WebApp ?? null
}

/**
 * Мини-приложение действительно запущено внутри Telegram: есть непустой initData.
 * Официальный скрипт загружается и в обычном браузере, но initData там пустая строка.
 * @see https://core.telegram.org/bots/webapps#initializing-mini-apps
 */
export function isTelegramMiniAppRuntime(webApp: WebApp | null): boolean {
    return Boolean(webApp && typeof webApp.initData === 'string' && webApp.initData.length > 0)
}
