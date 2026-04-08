/**
 * Telegram WebApp Mock Helper
 *
 * Provides utilities to mock Telegram WebApp context in E2E tests.
 * Handles:
 * - initData and initDataUnsafe setup
 * - Common WebApp methods (ready, expand, close, etc.)
 * - User and chat context
 * - Theme and color scheme
 */

import type { Page } from '@playwright/test'

export interface TelegramUserData {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
    allows_write_to_pm?: boolean
    photo_url?: string
}

export interface TelegramChatInstance {
    id: number
    type: 'private' | 'group' | 'supergroup' | 'channel'
    title?: string
    username?: string
    photo_url?: string
}

export interface TelegramWebAppConfig {
    user?: TelegramUserData
    chatInstance?: TelegramChatInstance
    authDate?: number
    hash?: string
    startParam?: string
    theme?: 'light' | 'dark'
    canCloseApp?: boolean
}

/**
 * Setup Telegram WebApp mock with default or custom config.
 *
 * Example:
 *   await setupTelegramWebApp(page)
 *   await setupTelegramWebApp(page, { user: { id: 123, first_name: 'John' } })
 */
export async function setupTelegramWebApp(page: Page, config?: TelegramWebAppConfig) {
    const defaultUser: TelegramUserData = {
        id: 100001,
        first_name: 'E2E',
        last_name: 'Tester',
        username: 'e2e_tester',
        language_code: 'en',
        is_premium: false,
        allows_write_to_pm: true,
    }

    const defaultChatInstance: TelegramChatInstance = {
        id: -1001234567890,
        type: 'private',
    }

    const user = config?.user ?? defaultUser
    const chatInstance = config?.chatInstance ?? defaultChatInstance
    const authDate = config?.authDate ?? Math.floor(Date.now() / 1000)
    const hash = config?.hash ?? 'e2e_mock_hash'
    const startParam = config?.startParam
    const theme = config?.theme ?? 'light'
    const canCloseApp = config?.canCloseApp ?? true

    // Build initData string (URL-encoded JSON for backwards compat with real Telegram)
    const initDataObj = {
        user,
        chat_instance: String(chatInstance.id),
        auth_date: authDate,
        hash,
        ...(startParam && { start_param: startParam }),
    }

    // URL encode the JSON string as Telegram does
    const initDataStr = Object.entries(initDataObj)
        .map(([key, val]) => `${key}=${encodeURIComponent(typeof val === 'object' ? JSON.stringify(val) : val)}`)
        .join('&')

    // Note: Real Telegram Mini Apps receive initData as a complete query string.
    // For testing, we can provide the parsed version directly.

    await page.addInitScript(
        (data) => {
            const w = window as Window & { Telegram?: { WebApp?: Record<string, unknown> } }

            w.Telegram = {
                WebApp: {
                    // Data
                    initData: data.initDataStr,
                    initDataUnsafe: data.initDataObj,
                    version: '9.0',
                    platform: 'web',

                    // Theme and appearance
                    colorScheme: data.theme === 'dark' ? 'dark' : 'light',
                    backgroundColor: data.theme === 'dark' ? '#222222' : '#FFFFFF',
                    textColor: data.theme === 'dark' ? '#FFFFFF' : '#000000',
                    hintColor: data.theme === 'dark' ? '#AAAAAA' : '#999999',
                    linkColor: data.theme === 'dark' ? '#5BBEE3' : '#0088CC',
                    buttonColor: data.theme === 'dark' ? '#2481CC' : '#1084D7',
                    buttonTextColor: '#FFFFFF',
                    secondaryBgColor: data.theme === 'dark' ? '#111111' : '#F2F2F2',
                    headerBgColor: data.theme === 'dark' ? '#17212B' : '#F3F3F5',
                    sectionBgColor: data.theme === 'dark' ? '#0F1419' : '#FFFFFF',
                    sectionHeaderTextColor: data.theme === 'dark' ? '#AAAAAA' : '#999999',

                    // Viewport
                    viewportHeight: 812,
                    viewportStableHeight: 800,
                    isExpanded: true,

                    // Capabilities
                    isClosingConfirmationEnabled: false,
                    safeAreaInset: {
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                    },
                    contentSafeAreaInset: {
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                    },

                    // Methods (stubs)
                    ready: () => {
                        // Stub: Mini App is ready
                    },
                    expand: () => {
                        // Stub: Expand to fullscreen
                    },
                    close: () => {
                        // Stub: Close Mini App
                    },
                    onEvent: (eventType: string, callback: () => void) => {
                        // Stub: Register event listener
                        console.log(`[Telegram] Event registered: ${eventType}`)
                    },
                    offEvent: (eventType: string, callback?: () => void) => {
                        // Stub: Unregister event listener
                    },
                    sendData: (data: Record<string, unknown>) => {
                        // Stub: Send data to Telegram
                        console.log('[Telegram] Data sent:', data)
                    },
                    openLink: (url: string, options?: { tryInstantView?: boolean }) => {
                        // Stub: Open URL
                        window.location.href = url
                    },
                    openTgLink: (url: string) => {
                        // Stub: Open Telegram link
                        console.log(`[Telegram] Opening Telegram link: ${url}`)
                    },
                    openInvoice: (url: string, callback?: () => void) => {
                        // Stub: Open invoice
                        console.log(`[Telegram] Opening invoice: ${url}`)
                    },
                    showPopup: (params: Record<string, unknown>, callback?: (buttonId?: string) => void) => {
                        // Stub: Show popup
                        console.log('[Telegram] Popup shown:', params)
                        if (callback) callback('ok')
                    },
                    showAlert: (message: string, callback?: () => void) => {
                        // Stub: Show alert
                        alert(message)
                        if (callback) callback()
                    },
                    showConfirm: (message: string, callback?: (confirmed: boolean) => void) => {
                        // Stub: Show confirm
                        const confirmed = confirm(message)
                        if (callback) callback(confirmed)
                    },
                    showScanQrPopup: (params: Record<string, unknown>, callback?: (data?: string) => void) => {
                        // Stub: Show QR scanner
                        console.log('[Telegram] QR scanner showed:', params)
                    },
                    closeScanQrPopup: () => {
                        // Stub: Close QR scanner
                    },
                    readTextFromClipboard: async () => {
                        // Stub: Read from clipboard
                        return 'mock-clipboard-data'
                    },
                    requestWriteAccess: (callback?: (canWrite: boolean) => void) => {
                        // Stub: Request write access
                        if (callback) callback(true)
                    },
                    requestContactAccess: (callback?: (canContact: boolean) => void) => {
                        // Stub: Request contact access
                        if (callback) callback(true)
                    },
                    requestPhoneAccess: (callback?: (canContact: boolean) => void) => {
                        // Stub: Request phone access
                        if (callback) callback(true)
                    },
                    SettingsButton: {
                        isVisible: false,
                        show: () => {
                            console.log('[Telegram] Settings button shown')
                        },
                        hide: () => {
                            console.log('[Telegram] Settings button hidden')
                        },
                        onClick: (callback: () => void) => {
                            console.log('[Telegram] Settings button click handler registered')
                        },
                    },
                    BackButton: {
                        isVisible: false,
                        show: () => {
                            console.log('[Telegram] Back button shown')
                        },
                        hide: () => {
                            console.log('[Telegram] Back button hidden')
                        },
                        onClick: (callback: () => void) => {
                            console.log('[Telegram] Back button click handler registered')
                        },
                    },
                    MainButton: {
                        text: 'OK',
                        color: '#0088CC',
                        textColor: '#FFFFFF',
                        isVisible: false,
                        isProgressVisible: false,
                        isActive: true,
                        setText: (text: string) => {
                            console.log(`[Telegram] MainButton text set to: ${text}`)
                        },
                        show: () => {
                            console.log('[Telegram] MainButton shown')
                        },
                        hide: () => {
                            console.log('[Telegram] MainButton hidden')
                        },
                        enable: () => {
                            console.log('[Telegram] MainButton enabled')
                        },
                        disable: () => {
                            console.log('[Telegram] MainButton disabled')
                        },
                        showProgress: () => {
                            console.log('[Telegram] MainButton progress shown')
                        },
                        hideProgress: () => {
                            console.log('[Telegram] MainButton progress hidden')
                        },
                        setParams: (params: Record<string, unknown>) => {
                            console.log('[Telegram] MainButton params set:', params)
                        },
                        onClick: (callback: () => void) => {
                            console.log('[Telegram] MainButton click handler registered')
                        },
                    },
                    SecondaryButton: {
                        text: 'Cancel',
                        color: '#F3F3F5',
                        textColor: '#222222',
                        isVisible: false,
                        isActive: true,
                        setText: (text: string) => {
                            console.log(`[Telegram] SecondaryButton text set to: ${text}`)
                        },
                        show: () => {
                            console.log('[Telegram] SecondaryButton shown')
                        },
                        hide: () => {
                            console.log('[Telegram] SecondaryButton hidden')
                        },
                        enable: () => {
                            console.log('[Telegram] SecondaryButton enabled')
                        },
                        disable: () => {
                            console.log('[Telegram] SecondaryButton disabled')
                        },
                        setParams: (params: Record<string, unknown>) => {
                            console.log('[Telegram] SecondaryButton params set:', params)
                        },
                        onClick: (callback: () => void) => {
                            console.log('[Telegram] SecondaryButton click handler registered')
                        },
                    },
                    HapticFeedback: {
                        impactOccurred: (style: string) => {
                            console.log(`[Telegram] Haptic feedback: ${style}`)
                        },
                        notificationOccurred: (type: string) => {
                            console.log(`[Telegram] Notification haptic: ${type}`)
                        },
                        selectionChanged: () => {
                            console.log('[Telegram] Selection haptic changed')
                        },
                    },
                    CloudStorage: {
                        getItem: async (key: string) => {
                            const data = localStorage.getItem(`telegram_cloud_${key}`)
                            return data ?? null
                        },
                        setItem: async (key: string, value: string) => {
                            localStorage.setItem(`telegram_cloud_${key}`, value)
                        },
                        removeItem: async (key: string) => {
                            localStorage.removeItem(`telegram_cloud_${key}`)
                        },
                        getKeys: async () => {
                            return Object.keys(localStorage)
                                .filter((k) => k.startsWith('telegram_cloud_'))
                                .map((k) => k.replace('telegram_cloud_', ''))
                        },
                    },
                    BiometricManager: {
                        isAvailable: false,
                        isBiometricIdAvailable: false,
                        authenticate: async () => {
                            return true
                        },
                        requestAccess: async (reason: string) => {
                            return true
                        },
                        update: () => {},
                    },
                    isVersionAtLeast: (version: string) => {
                        return true
                    },
                },
            }

            // Emit ready event to mimic real Mini App flow
            if (data.canCloseApp) {
                setTimeout(() => {
                    const event = new Event('init')
                    window.dispatchEvent(event)
                }, 100)
            }
        },
        {
            initDataStr,
            initDataObj,
            theme,
            canCloseApp,
        },
    )
}

/**
 * Mock Telegram auth via WebApp.initData injection.
 * Used when testing Telegram authentication flow without real Telegram.
 */
export async function mockTelegramAuth(
    page: Page,
    user: TelegramUserData = {
        id: 100001,
        first_name: 'E2E',
        username: 'e2e_tester',
    },
) {
    await setupTelegramWebApp(page, { user })
}

/**
 * Verify Telegram context is available on the page.
 */
export async function isTelegramAvailable(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const w = window as Window & { Telegram?: { WebApp?: unknown } }
        return !!(w.Telegram?.WebApp)
    })
}

/**
 * Get current Telegram user data from page context.
 */
export async function getTelegramUser(page: Page): Promise<TelegramUserData | null> {
    return page.evaluate(() => {
        const w = window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: Record<string, unknown> } } }
        const initDataUnsafe = w.Telegram?.WebApp?.initDataUnsafe
        return (initDataUnsafe?.user as TelegramUserData) ?? null
    })
}
