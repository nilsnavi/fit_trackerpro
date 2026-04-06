import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { useMemo, useState } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { api } from '@shared/api/client'
import { getErrorMessage } from '@shared/errors'
import { useAuthStore } from '@/stores/authStore'

export function LoginPage() {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()
    const setTokens = useAuthStore((s) => s.setTokens)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
            const res = await api.post<{ access_token: string; refresh_token?: string | null }>(
                '/users/auth/telegram',
                {
                init_data: tg.initData,
                },
            )
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
