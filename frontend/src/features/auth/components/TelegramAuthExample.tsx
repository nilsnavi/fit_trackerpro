/**
 * Telegram Authentication Example Component
 * Demonstrates usage of useTelegramWebApp hook and backend auth
 */
import { useEffect, useState } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import type { TelegramUser, ThemeParams } from '@shared/types/telegram'
import { AppHttpError, clientErrorFromFetchResponse, getErrorMessage } from '@shared/errors'

interface AuthState {
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    user: TelegramUser | null
    token: string | null
}

export function TelegramAuthExample() {
    const tg = useTelegramWebApp()
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        user: null,
        token: null
    })

    // Initialize WebApp on mount
    useEffect(() => {
        if (tg.isTelegram) {
            tg.init()

            // Apply Telegram theme
            const theme = tg.getTheme()
            if (theme) {
                applyTheme(theme)
            }
        }
    }, [tg])

    // Apply Telegram theme colors to CSS variables
    const applyTheme = (theme: ThemeParams) => {
        const root = document.documentElement

        if (theme.bg_color) {
            root.style.setProperty('--tg-theme-bg-color', theme.bg_color)
        }
        if (theme.text_color) {
            root.style.setProperty('--tg-theme-text-color', theme.text_color)
        }
        if (theme.button_color) {
            root.style.setProperty('--tg-theme-button-color', theme.button_color)
        }
        if (theme.button_text_color) {
            root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color)
        }
        if (theme.secondary_bg_color) {
            root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color)
        }
    }

    // Authenticate with backend
    const handleAuthenticate = async () => {
        if (!tg.webApp) {
            setAuthState(prev => ({
                ...prev,
                error: 'Not running in Telegram WebApp'
            }))
            return
        }

        setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

        try {
            // Get initData from WebApp
            const initData = tg.webApp.initData

            if (!initData) {
                throw new Error('No initData available')
            }

            // Send to backend for validation
            const response = await fetch('/api/v1/users/auth/telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ init_data: initData })
            })

            if (!response.ok) {
                throw new AppHttpError(await clientErrorFromFetchResponse(response))
            }

            const data = await response.json()

            // Store token
            localStorage.setItem('auth_token', data.access_token)

            // Update state
            setAuthState({
                isAuthenticated: true,
                isLoading: false,
                error: null,
                user: data.user,
                token: data.access_token
            })

            // Success haptic feedback
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })

        } catch (err) {
            setAuthState(prev => ({
                ...prev,
                isLoading: false,
                error: getErrorMessage(err)
            }))

            // Error haptic feedback
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
        }
    }

    // Validate initData only (no session creation)
    const handleValidate = async () => {
        if (!tg.webApp?.initData) {
            setAuthState(prev => ({
                ...prev,
                error: 'No initData available'
            }))
            return
        }

        setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

        try {
            const response = await fetch('/api/v1/users/auth/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ init_data: tg.webApp.initData })
            })

            if (!response.ok) {
                throw new AppHttpError(await clientErrorFromFetchResponse(response))
            }

            const data = await response.json()

            if (data.valid) {
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
                tg.showAlert('Validation successful!')
            } else {
                throw new Error(data.message)
            }

        } catch (err) {
            setAuthState(prev => ({
                ...prev,
                isLoading: false,
                error: getErrorMessage(err)
            }))
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
        } finally {
            setAuthState(prev => ({ ...prev, isLoading: false }))
        }
    }

    // Test different haptic feedback types
    const testHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
        switch (type) {
            case 'light':
            case 'medium':
            case 'heavy':
                tg.hapticFeedback({ type: 'impact', style: type })
                break
            case 'success':
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
                break
            case 'error':
                tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
                break
        }
    }

    // Expand to full screen
    const handleExpand = () => {
        tg.expand()
        tg.hapticFeedback({ type: 'impact', style: 'light' })
    }

    // Close WebApp
    const handleClose = () => {
        tg.close()
    }

    // Show main button
    const handleShowMainButton = () => {
        tg.showMainButton(
            'Save Workout',
            () => {
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
                tg.showAlert('Workout saved!')
            },
            tg.theme?.button_color
        )
    }

    // Show popup
    const handleShowPopup = async () => {
        const buttonId = await tg.showPopup(
            'Confirm Action',
            'Are you sure you want to proceed?',
            [
                { id: 'cancel', type: 'cancel', text: 'Cancel' },
                { id: 'confirm', type: 'default', text: 'Confirm' }
            ]
        )

        if (buttonId === 'confirm') {
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
        }
    }

    // If not in Telegram
    if (!tg.isTelegram) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h2 className="text-lg font-semibold text-yellow-800 mb-2">
                    Not in Telegram
                </h2>
                <p className="text-yellow-700">
                    This component is designed to run inside Telegram WebApp.
                    Please open this app through Telegram.
                </p>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-6" style={{
            backgroundColor: tg.theme?.bg_color || '#ffffff',
            color: tg.theme?.text_color || '#000000'
        }}>
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">
                    Telegram Auth Demo
                </h1>
                <p className="text-sm opacity-70">
                    Platform: {tg.webApp?.platform} | Version: {tg.webApp?.version}
                </p>
            </div>

            {/* User Info */}
            {tg.user && (
                <div className="p-4 rounded-lg" style={{
                    backgroundColor: tg.theme?.secondary_bg_color || '#f5f5f5'
                }}>
                    <h3 className="font-semibold mb-2">Current User</h3>
                    <div className="space-y-1 text-sm">
                        <p><strong>ID:</strong> {tg.user.id}</p>
                        <p><strong>Name:</strong> {tg.user.first_name} {tg.user.last_name}</p>
                        {tg.user.username && (
                            <p><strong>Username:</strong> @{tg.user.username}</p>
                        )}
                        {tg.user.is_premium && (
                            <p className="text-yellow-500">⭐ Premium User</p>
                        )}
                    </div>
                </div>
            )}

            {/* Theme Info */}
            {tg.theme && (
                <div className="p-4 rounded-lg" style={{
                    backgroundColor: tg.theme?.secondary_bg_color || '#f5f5f5'
                }}>
                    <h3 className="font-semibold mb-2">Theme</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: tg.theme.bg_color }}
                            />
                            <span>BG: {tg.theme.bg_color}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: tg.theme.text_color }}
                            />
                            <span>Text: {tg.theme.text_color}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: tg.theme.button_color }}
                            />
                            <span>Button: {tg.theme.button_color}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Auth Status */}
            {authState.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {authState.error}
                </div>
            )}

            {authState.isAuthenticated && (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                    ✅ Authenticated as {authState.user?.first_name}
                </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
                <h3 className="font-semibold">Authentication</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleAuthenticate}
                        disabled={authState.isLoading}
                        className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: tg.theme?.button_color || '#2481cc' }}
                    >
                        {authState.isLoading ? 'Loading...' : 'Authenticate'}
                    </button>
                    <button
                        onClick={handleValidate}
                        disabled={authState.isLoading}
                        className="px-4 py-2 rounded-lg font-medium border"
                        style={{
                            borderColor: tg.theme?.button_color || '#2481cc',
                            color: tg.theme?.button_color || '#2481cc'
                        }}
                    >
                        Validate Only
                    </button>
                </div>
            </div>

            {/* Haptic Feedback Tests */}
            <div className="space-y-3">
                <h3 className="font-semibold">Haptic Feedback</h3>
                <div className="grid grid-cols-3 gap-2">
                    {(['light', 'medium', 'heavy'] as const).map((style) => (
                        <button
                            key={style}
                            onClick={() => testHaptic(style)}
                            className="px-3 py-2 text-sm rounded border capitalize"
                            style={{ borderColor: tg.theme?.hint_color || '#999' }}
                        >
                            {style}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => testHaptic('success')}
                        className="px-3 py-2 text-sm rounded bg-green-500 text-white"
                    >
                        Success
                    </button>
                    <button
                        onClick={() => testHaptic('error')}
                        className="px-3 py-2 text-sm rounded bg-red-500 text-white"
                    >
                        Error
                    </button>
                </div>
            </div>

            {/* WebApp Controls */}
            <div className="space-y-3">
                <h3 className="font-semibold">WebApp Controls</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleExpand}
                        className="px-3 py-2 text-sm rounded border"
                        style={{ borderColor: tg.theme?.hint_color || '#999' }}
                    >
                        Expand
                    </button>
                    <button
                        onClick={handleClose}
                        className="px-3 py-2 text-sm rounded border"
                        style={{ borderColor: tg.theme?.hint_color || '#999' }}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* UI Components */}
            <div className="space-y-3">
                <h3 className="font-semibold">UI Components</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleShowMainButton}
                        className="px-3 py-2 text-sm rounded border"
                        style={{ borderColor: tg.theme?.hint_color || '#999' }}
                    >
                        Show Main Button
                    </button>
                    <button
                        onClick={handleShowPopup}
                        className="px-3 py-2 text-sm rounded border"
                        style={{ borderColor: tg.theme?.hint_color || '#999' }}
                    >
                        Show Popup
                    </button>
                </div>
            </div>

            {/* Cloud Storage */}
            <div className="space-y-3">
                <h3 className="font-semibold">Cloud Storage</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={async () => {
                            await tg.cloudStorage.setItem('test_key', 'Hello from WebApp!')
                            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
                        }}
                        className="px-3 py-2 text-sm rounded border"
                        style={{ borderColor: tg.theme?.hint_color || '#999' }}
                    >
                        Save to Cloud
                    </button>
                    <button
                        onClick={async () => {
                            const value = await tg.cloudStorage.getItem('test_key')
                            tg.showAlert(`Value: ${value || 'Not found'}`)
                        }}
                        className="px-3 py-2 text-sm rounded border"
                        style={{ borderColor: tg.theme?.hint_color || '#999' }}
                    >
                        Read from Cloud
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TelegramAuthExample
