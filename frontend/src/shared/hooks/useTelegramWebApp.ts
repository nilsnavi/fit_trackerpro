/**
 * Telegram WebApp Hook
 * Provides comprehensive integration with Telegram WebApp API
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getTelegramWebAppFromWindow, isTelegramMiniAppRuntime } from '@shared/lib/telegramEnv'
import type {
    WebApp,
    TelegramUser,
    ThemeParams,
    HapticImpactStyle,
    HapticNotificationType
} from '../types/telegram'

/**
 * Haptic feedback types
 */
export type HapticType =
    | { type: 'impact'; style: HapticImpactStyle }
    | { type: 'notification'; notificationType: HapticNotificationType }
    | { type: 'selection' }

/**
 * Hook return type
 */
export interface UseTelegramWebAppReturn {
    /** Telegram WebApp instance (есть и в обычном браузере после загрузки скрипта) */
    webApp: WebApp | null
    /** Whether the WebApp is ready */
    isReady: boolean
    /** Current user data */
    user: TelegramUser | null
    /** Current theme parameters */
    theme: ThemeParams | null
    /** Color scheme (light/dark) */
    colorScheme: 'light' | 'dark' | null
    /** Сырая строка initData для валидации на бэкенде; вне Telegram — пустая */
    initData: string
    /** telegram: Mini App в клиенте; browser: скрипт есть, но initData пустой */
    launchMode: 'telegram' | 'browser'
    /** Initialize the WebApp */
    init: () => void
    /** Get user data */
    getUser: () => TelegramUser | null
    /** Get theme parameters */
    getTheme: () => ThemeParams | null
    /** Trigger haptic feedback */
    hapticFeedback: (type: HapticType) => void
    /** Close the WebApp */
    close: () => void
    /** Expand to full screen */
    expand: () => void
    /** True только при непустом initData (реальный запуск из Telegram) */
    isTelegram: boolean
    /** Show main button */
    showMainButton: (text: string, onClick: () => void, color?: string) => void
    /** Hide main button */
    hideMainButton: () => void
    /** Enable main button */
    enableMainButton: () => void
    /** Disable main button */
    disableMainButton: () => void
    /** Show main button progress */
    showMainButtonProgress: (leaveActive?: boolean) => void
    /** Hide main button progress */
    hideMainButtonProgress: () => void
    /** Show back button */
    showBackButton: (onClick: () => void) => void
    /** Hide back button */
    hideBackButton: () => void
    /** Set header color */
    setHeaderColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void
    /** Set background color */
    setBackgroundColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void
    /** Show popup */
    showPopup: (title: string, message: string, buttons?: { id?: string; type?: string; text?: string }[]) => Promise<string | null>
    /** Show alert */
    showAlert: (message: string) => Promise<void>
    /** Show confirm */
    showConfirm: (message: string) => Promise<boolean>
    /** Send data to bot */
    sendData: (data: string) => void
    /** Open link externally */
    openLink: (url: string, tryInstantView?: boolean) => void
    /** Open Telegram link */
    openTelegramLink: (url: string) => void
    /** Enable closing confirmation */
    enableClosingConfirmation: () => void
    /** Disable closing confirmation */
    disableClosingConfirmation: () => void
    /** Cloud storage methods */
    cloudStorage: {
        setItem: (key: string, value: string) => Promise<boolean>
        getItem: (key: string) => Promise<string | null>
        getItems: (keys: string[]) => Promise<Record<string, string> | null>
        removeItem: (key: string) => Promise<boolean>
        removeItems: (keys: string[]) => Promise<boolean>
        getKeys: () => Promise<string[] | null>
    }
}

/**
 * Hook for Telegram WebApp integration
 */
export function useTelegramWebApp(): UseTelegramWebAppReturn {
    const [webApp] = useState<WebApp | null>(() => getTelegramWebAppFromWindow())
    const isTelegram = isTelegramMiniAppRuntime(webApp)
    const initData = webApp?.initData ?? ''
    const launchMode: 'telegram' | 'browser' = isTelegram ? 'telegram' : 'browser'

    const [isReady, setIsReady] = useState(false)
    const [user] = useState<TelegramUser | null>(() => {
        const tg = getTelegramWebAppFromWindow()
        if (tg && isTelegramMiniAppRuntime(tg) && tg.initDataUnsafe?.user) {
            return tg.initDataUnsafe.user as TelegramUser
        }
        return null
    })
    const [theme, setTheme] = useState<ThemeParams | null>(() => getTelegramWebAppFromWindow()?.themeParams ?? null)
    const [colorScheme, setColorScheme] = useState<'light' | 'dark' | null>(
        () => getTelegramWebAppFromWindow()?.colorScheme ?? null,
    )

    const webAppRef = useRef<WebApp | null>(webApp)
    webAppRef.current = webApp

    // Тема из Telegram только в реальном Mini App; в браузере не подписываемся на события заглушки
    useEffect(() => {
        const tg = webAppRef.current
        if (!tg || !isTelegramMiniAppRuntime(tg)) return

        const handleThemeChanged = () => {
            const current = webAppRef.current
            if (!current) return
            setColorScheme(current.colorScheme)
            setTheme(current.themeParams)
        }

        tg.onEvent('themeChanged', handleThemeChanged)

        return () => {
            tg.offEvent('themeChanged', handleThemeChanged)
        }
    }, [webApp])

    /**
     * Initialize the WebApp
     */
    const init = useCallback(() => {
        try {
            if (webAppRef.current) {
                webAppRef.current.ready()
                setIsReady(true)
            }
        } catch {
            setIsReady(true)
        }
    }, [])

    /**
     * Get user data
     */
    const getUser = useCallback((): TelegramUser | null => {
        const tg = webAppRef.current
        if (!tg || !isTelegramMiniAppRuntime(tg)) return null
        if (tg.initDataUnsafe?.user) {
            return tg.initDataUnsafe.user as TelegramUser
        }
        return user
    }, [user])

    /**
     * Get theme parameters
     */
    const getTheme = useCallback((): ThemeParams | null => {
        if (webAppRef.current) {
            return webAppRef.current.themeParams
        }
        return theme
    }, [theme])

    /**
     * Trigger haptic feedback
     */
    const hapticFeedback = useCallback((type: HapticType) => {
        if (!isTelegramMiniAppRuntime(webAppRef.current)) return
        if (!webAppRef.current?.HapticFeedback) return

        const haptic = webAppRef.current.HapticFeedback

        switch (type.type) {
            case 'impact':
                haptic.impactOccurred(type.style)
                break
            case 'notification':
                haptic.notificationOccurred(type.notificationType)
                break
            case 'selection':
                haptic.selectionChanged()
                break
        }
    }, [])

    /**
     * Close the WebApp
     */
    const close = useCallback(() => {
        webAppRef.current?.close()
    }, [])

    /**
     * Expand to full screen
     */
    const expand = useCallback(() => {
        webAppRef.current?.expand()
    }, [])

    /**
     * Show main button
     */
    const showMainButton = useCallback((text: string, onClick: () => void, color?: string) => {
        if (!isTelegramMiniAppRuntime(webAppRef.current)) return
        if (!webAppRef.current?.MainButton) return

        const mainButton = webAppRef.current.MainButton
        mainButton.setText(text)
        mainButton.onClick(onClick)
        if (color) {
            mainButton.setParams({ color })
        }
        mainButton.show()
    }, [])

    /**
     * Hide main button
     */
    const hideMainButton = useCallback(() => {
        webAppRef.current?.MainButton?.hide()
    }, [])

    /**
     * Enable main button
     */
    const enableMainButton = useCallback(() => {
        webAppRef.current?.MainButton?.enable()
    }, [])

    /**
     * Disable main button
     */
    const disableMainButton = useCallback(() => {
        webAppRef.current?.MainButton?.disable()
    }, [])

    /**
     * Show main button progress
     */
    const showMainButtonProgress = useCallback((leaveActive?: boolean) => {
        webAppRef.current?.MainButton?.showProgress(leaveActive)
    }, [])

    /**
     * Hide main button progress
     */
    const hideMainButtonProgress = useCallback(() => {
        webAppRef.current?.MainButton?.hideProgress()
    }, [])

    /**
     * Show back button
     */
    const showBackButton = useCallback((onClick: () => void) => {
        if (!isTelegramMiniAppRuntime(webAppRef.current)) return
        if (!webAppRef.current?.BackButton) return

        webAppRef.current.BackButton.onClick(onClick)
        webAppRef.current.BackButton.show()
    }, [])

    /**
     * Hide back button
     */
    const hideBackButton = useCallback(() => {
        webAppRef.current?.BackButton?.hide()
    }, [])

    /**
     * Set header color
     */
    const setHeaderColor = useCallback((color: 'bg_color' | 'secondary_bg_color' | string) => {
        webAppRef.current?.setHeaderColor(color)
    }, [])

    /**
     * Set background color
     */
    const setBackgroundColor = useCallback((color: 'bg_color' | 'secondary_bg_color' | string) => {
        webAppRef.current?.setBackgroundColor(color)
    }, [])

    /**
     * Show popup
     */
    const showPopup = useCallback((
        title: string,
        message: string,
        buttons?: { id?: string; type?: string; text?: string }[]
    ): Promise<string | null> => {
        return new Promise((resolve) => {
            if (!webAppRef.current) {
                resolve(null)
                return
            }

            webAppRef.current.showPopup(
                {
                    title,
                    message,
                    buttons: buttons as { id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }[]
                },
                (buttonId: string | null) => resolve(buttonId)
            )
        })
    }, [])

    /**
     * Show alert
     */
    const showAlert = useCallback((message: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!webAppRef.current) {
                resolve()
                return
            }

            webAppRef.current.showAlert(message, () => resolve())
        })
    }, [])

    /**
     * Show confirm
     */
    const showConfirm = useCallback((message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!webAppRef.current) {
                resolve(false)
                return
            }

            webAppRef.current.showConfirm(message, (isConfirmed: boolean) => resolve(isConfirmed))
        })
    }, [])

    /**
     * Send data to bot
     */
    const sendData = useCallback((data: string) => {
        webAppRef.current?.sendData(data)
    }, [])

    /**
     * Open link externally
     */
    const openLink = useCallback((url: string, tryInstantView?: boolean) => {
        webAppRef.current?.openLink(url, { try_instant_view: tryInstantView })
    }, [])

    /**
     * Open Telegram link
     */
    const openTelegramLink = useCallback((url: string) => {
        webAppRef.current?.openTelegramLink(url)
    }, [])

    /**
     * Enable closing confirmation
     */
    const enableClosingConfirmation = useCallback(() => {
        webAppRef.current?.enableClosingConfirmation()
    }, [])

    /**
     * Disable closing confirmation
     */
    const disableClosingConfirmation = useCallback(() => {
        webAppRef.current?.disableClosingConfirmation()
    }, [])

    const cloudStorage = useMemo(
        () => ({
            setItem: (key: string, value: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    if (!webAppRef.current?.CloudStorage) {
                        resolve(false)
                        return
                    }
                    webAppRef.current.CloudStorage.setItem(key, value, (error: string | null, result?: boolean) => {
                        resolve(!error && result === true)
                    })
                })
            },
            getItem: (key: string): Promise<string | null> => {
                return new Promise((resolve) => {
                    if (!webAppRef.current?.CloudStorage) {
                        resolve(null)
                        return
                    }
                    webAppRef.current.CloudStorage.getItem(key, (error: string | null, result?: string) => {
                        resolve(error ? null : result || null)
                    })
                })
            },
            getItems: (keys: string[]): Promise<Record<string, string> | null> => {
                return new Promise((resolve) => {
                    if (!webAppRef.current?.CloudStorage) {
                        resolve(null)
                        return
                    }
                    webAppRef.current.CloudStorage.getItems(keys, (error: string | null, result?: Record<string, string>) => {
                        resolve(error ? null : result || null)
                    })
                })
            },
            removeItem: (key: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    if (!webAppRef.current?.CloudStorage) {
                        resolve(false)
                        return
                    }
                    webAppRef.current.CloudStorage.removeItem(key, (error: string | null, result?: boolean) => {
                        resolve(!error && result === true)
                    })
                })
            },
            removeItems: (keys: string[]): Promise<boolean> => {
                return new Promise((resolve) => {
                    if (!webAppRef.current?.CloudStorage) {
                        resolve(false)
                        return
                    }
                    webAppRef.current.CloudStorage.removeItems(keys, (error: string | null, result?: boolean) => {
                        resolve(!error && result === true)
                    })
                })
            },
            getKeys: (): Promise<string[] | null> => {
                return new Promise((resolve) => {
                    if (!webAppRef.current?.CloudStorage) {
                        resolve(null)
                        return
                    }
                    webAppRef.current.CloudStorage.getKeys((error: string | null, result?: string[]) => {
                        resolve(error ? null : result || null)
                    })
                })
            },
        }),
        [],
    )

    return useMemo(
        () => ({
            webApp,
            isReady,
            user,
            theme,
            colorScheme,
            initData,
            launchMode,
            init,
            getUser,
            getTheme,
            hapticFeedback,
            close,
            expand,
            isTelegram,
            showMainButton,
            hideMainButton,
            enableMainButton,
            disableMainButton,
            showMainButtonProgress,
            hideMainButtonProgress,
            showBackButton,
            hideBackButton,
            setHeaderColor,
            setBackgroundColor,
            showPopup,
            showAlert,
            showConfirm,
            sendData,
            openLink,
            openTelegramLink,
            enableClosingConfirmation,
            disableClosingConfirmation,
            cloudStorage,
        }),
        [
            webApp,
            isReady,
            user,
            theme,
            colorScheme,
            initData,
            launchMode,
            isTelegram,
            init,
            getUser,
            getTheme,
            hapticFeedback,
            close,
            expand,
            showMainButton,
            hideMainButton,
            enableMainButton,
            disableMainButton,
            showMainButtonProgress,
            hideMainButtonProgress,
            showBackButton,
            hideBackButton,
            setHeaderColor,
            setBackgroundColor,
            showPopup,
            showAlert,
            showConfirm,
            sendData,
            openLink,
            openTelegramLink,
            enableClosingConfirmation,
            disableClosingConfirmation,
            cloudStorage,
        ],
    )
}

export default useTelegramWebApp
