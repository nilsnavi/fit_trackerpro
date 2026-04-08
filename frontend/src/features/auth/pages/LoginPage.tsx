import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { useMemo, useState } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { getErrorMessage } from '@shared/errors'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@features/profile/api/authApi'

type TelegramLoginFallbackResponse = {
    access_token: string
    refresh_token?: string | null
}

type TelegramLoginSafeResult = {
    data: TelegramLoginFallbackResponse
    via: 'authApi' | 'fetch'
}

type RuntimeWindow = Window & {
    __APP_CONFIG__?: {
        API_URL?: string
    }
}

function getApiBaseUrl(): string {
    const configured = (window as RuntimeWindow).__APP_CONFIG__?.API_URL?.trim()
    if (configured && configured.length > 0) {
        return configured.replace(/\/$/, '')
    }
    return '/api/v1'
}

async function telegramLoginFetch(initData: string): Promise<TelegramLoginFallbackResponse> {
    const response = await fetch(`${getApiBaseUrl()}/users/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: initData }),
    })

    const data = (await response.json()) as TelegramLoginFallbackResponse | { detail?: string }
    if (!response.ok) {
        const detail = typeof data === 'object' && data && 'detail' in data ? data.detail : undefined
        throw new Error(detail || `HTTP ${response.status}`)
    }

    return data as TelegramLoginFallbackResponse
}

async function telegramLoginSafe(initData: string): Promise<TelegramLoginSafeResult> {
    const loginFn = (authApi as { telegramLogin?: (value: string) => Promise<TelegramLoginFallbackResponse> }).telegramLogin
    if (typeof loginFn === 'function') {
        return {
            data: await loginFn(initData),
            via: 'authApi',
        }
    }
    return {
        data: await telegramLoginFetch(initData),
        via: 'fetch',
    }
}

export function LoginPage() {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()
    const setTokens = useAuthStore((s) => s.setTokens)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [usedFallback, setUsedFallback] = useState(false)

    const returnUrl = useMemo(() => {
        const url = new URL(window.location.href)
        const from = url.searchParams.get('from')
        if (from && from.startsWith('/')) return from
        try {
            const stored = sessionStorage.getItem('return_url_after_login')
            if (stored && stored.startsWith('/')) return stored
        } catch {
            // ignore
        }
        return '/profile'
    }, [])

    const handleTelegramLogin = async () => {
        setError(null)
        if (!tg.initData) {
            setError('Откройте приложение из Telegram — initData недоступна в браузере.')
            return
        }
        setIsSubmitting(true)
        try {
            const result = await telegramLoginSafe(tg.initData)
            const res = result.data
            setUsedFallback(result.via === 'fetch')
            if (!res?.access_token) {
                throw new Error('Не получен access_token')
            }
            setTokens({ accessToken: res.access_token, refreshToken: res.refresh_token })
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
            navigate(returnUrl, { replace: true })
        } catch (e) {
            setError(getErrorMessage(e))
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-telegram-secondary-bg"
                    aria-label="Назад"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold text-telegram-text">Вход</h1>
            </div>

            {!tg.isTelegram && (
                <p className="text-sm text-telegram-hint">
                    Для входа откройте Mini App из Telegram. В обычном браузере Telegram initData недоступна.
                </p>
            )}

            {error && (
                <p className="text-sm text-danger" role="alert">
                    {error}
                </p>
            )}

            {usedFallback && !error && (
                <p className="text-xs text-telegram-hint" role="status">
                    Использован резервный канал авторизации. Если проблема повторится, обновите Mini App.
                </p>
            )}

            <Button
                type="button"
                className="w-full"
                disabled={isSubmitting || !tg.initData}
                onClick={() => void handleTelegramLogin()}
            >
                {isSubmitting ? 'Вход…' : 'Войти через Telegram'}
            </Button>

            <Button type="button" variant="secondary" className="w-full" onClick={() => navigate('/')}>
                На главную
            </Button>
        </div>
    )
}
