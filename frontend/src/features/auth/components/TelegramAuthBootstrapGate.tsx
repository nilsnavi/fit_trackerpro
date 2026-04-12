import { PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useTelegramContext } from '@app/providers/TelegramProvider'
import { OnboardingScreen } from '@/components/Onboarding'
import { exchangeTelegramInitData } from '@/hooks/useTelegramAuth'
import { authApi } from '@features/profile/api/authApi'
import { getErrorMessage } from '@shared/errors'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'
import { useAuthStore } from '@/stores/authStore'

type BootstrapStatus =
    | 'loading'
    | 'ready'
    | 'error'
    | 'no_telegram'
    | 'expired'
    | 'dev_local'

export function TelegramAuthBootstrapGate({ children }: PropsWithChildren) {
    const location = useLocation()
    const navigate = useNavigate()
    const { isTelegram, initData, hapticFeedback, user } = useTelegramContext()
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const setTokens = useAuthStore((s) => s.setTokens)
    const clearAuth = useAuthStore((s) => s.clear)

    const [status, setStatus] = useState<BootstrapStatus>('loading')
    const [error, setError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [usedFallback, setUsedFallback] = useState(false)
    const [needsOnboarding, setNeedsOnboarding] = useState(false)

    const [devPastedInit, setDevPastedInit] = useState('')
    const [devAuthError, setDevAuthError] = useState<string | null>(null)

    const runBootstrap = useCallback(async () => {
        setError(null)
        setStatus('loading')

        if (isAuthenticated) {
            try {
                const profile = await authApi.getCurrentUser()
                const onboardingCompleted = profile.profile?.onboarding_completed === true
                setNeedsOnboarding(!onboardingCompleted)
                setStatus('ready')
                return
            } catch (e) {
                clearAuth()
                setError(getErrorMessage(e))
                setStatus('error')
                return
            }
        }

        const devInitFromEnv = import.meta.env.VITE_DEV_INIT_DATA?.trim()
        if (import.meta.env.DEV && !initData && devInitFromEnv) {
            try {
                const result = await exchangeTelegramInitData(devInitFromEnv)
                setUsedFallback(result.via === 'fetch')
                setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken })
                setNeedsOnboarding(result.onboardingRequired)
                setStatus('ready')
                hapticFeedback({ type: 'notification', notificationType: 'success' })
            } catch (e) {
                setDevAuthError(getErrorMessage(e))
                setStatus('dev_local')
            }
            return
        }

        if (!isTelegram || !initData) {
            if (import.meta.env.DEV) {
                setStatus('dev_local')
                return
            }
            setStatus('no_telegram')
            return
        }

        try {
            const result = await exchangeTelegramInitData(initData)
            setUsedFallback(result.via === 'fetch')
            setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken })
            setNeedsOnboarding(result.onboardingRequired)
            setStatus('ready')
            hapticFeedback({ type: 'notification', notificationType: 'success' })
        } catch (e) {
            setError(getErrorMessage(e))
            setStatus('error')
            hapticFeedback({ type: 'notification', notificationType: 'error' })
        }
    }, [clearAuth, hapticFeedback, initData, isAuthenticated, isTelegram, setTokens])

    useEffect(() => {
        void runBootstrap()
    }, [attempt, runBootstrap])

    useEffect(() => {
        const handleExpired = () => {
            clearAuth()
            setStatus('expired')
            const timer = setTimeout(() => setAttempt((v) => v + 1), 1200)
            return () => clearTimeout(timer)
        }
        window.addEventListener('auth:session-expired', handleExpired)
        return () => window.removeEventListener('auth:session-expired', handleExpired)
    }, [clearAuth])

    const retry = useCallback(() => {
        setAttempt((value) => value + 1)
    }, [])

    const handleDevPasteLogin = useCallback(async () => {
        const raw = devPastedInit.trim()
        if (!raw) {
            setDevAuthError('Вставьте строку initData из Telegram WebApp.')
            return
        }
        setDevAuthError(null)
        try {
            const result = await exchangeTelegramInitData(raw)
            setUsedFallback(result.via === 'fetch')
            setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken })
            setNeedsOnboarding(result.onboardingRequired)
            setStatus('ready')
        } catch (e) {
            setDevAuthError(getErrorMessage(e))
        }
    }, [devPastedInit, setTokens])

    if (status === 'loading') {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-telegram-text">Подключение к Telegram</h1>
                    <p className="mt-2 text-sm text-telegram-hint">
                        Проверяем сессию и подготавливаем ваш профиль.
                    </p>
                </Card>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-danger">Ошибка авторизации</h1>
                    <p className="mt-2 text-sm text-telegram-hint" role="alert">
                        {error ?? 'Не удалось авторизоваться через Telegram.'}
                    </p>
                    <Button type="button" className="mt-4 w-full" onClick={retry}>
                        Повторить
                    </Button>
                </Card>
            </div>
        )
    }

    if (status === 'expired') {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-telegram-text">Сессия истекла</h1>
                    <p className="mt-2 text-sm text-telegram-hint">Восстанавливаем подключение...</p>
                    <Button type="button" variant="secondary" className="mt-4 w-full" onClick={retry}>
                        Повторить вход
                    </Button>
                </Card>
            </div>
        )
    }

    if (status === 'dev_local' && !isAuthenticated) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-telegram-text">Режим разработки</h1>
                    <p className="mt-2 text-sm text-telegram-hint">
                        Контекст Telegram недоступен (нет initData). Показан условный пользователь для локальной
                        вёрстки.
                    </p>
                    <div className="mt-4 rounded-xl border border-border bg-telegram-secondary-bg px-3 py-3 text-sm text-telegram-text">
                        <p className="font-medium">Mock-пользователь</p>
                        <p className="mt-1 text-xs text-telegram-hint">ID: 100000 · Имя: Локальный разработчик</p>
                    </div>
                    {devAuthError && (
                        <p className="mt-3 text-sm text-danger" role="alert">
                            {devAuthError}
                        </p>
                    )}
                    <label className="mt-4 block">
                        <span className="text-xs font-medium text-telegram-hint">initData (вставка для входа)</span>
                        <textarea
                            value={devPastedInit}
                            onChange={(e) => setDevPastedInit(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 font-mono text-[11px] text-telegram-text outline-none focus:ring-2 focus:ring-primary/40"
                            placeholder="query_id=...&user=...&auth_date=...&hash=..."
                        />
                    </label>
                    <Button type="button" className="mt-3 w-full" onClick={() => void handleDevPasteLogin()}>
                        Авторизоваться с этим initData
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        className="mt-2 w-full"
                        onClick={() => navigate('/')}
                    >
                        На главную (без входа)
                    </Button>
                    <p className="mt-3 text-[11px] text-telegram-hint">
                        Опционально задайте <code className="rounded bg-telegram-bg px-1">VITE_DEV_INIT_DATA</code> в{' '}
                        <code className="rounded bg-telegram-bg px-1">.env.local</code> для автоматического входа.
                    </p>
                </Card>
            </div>
        )
    }

    if (status === 'no_telegram' && !isAuthenticated) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-telegram-text">Откройте Mini App в Telegram</h1>
                    <p className="mt-2 text-sm text-telegram-hint">
                        Контекст Telegram недоступен. Запустите приложение через Telegram и попробуйте снова.
                    </p>
                    <Button type="button" variant="secondary" className="mt-4 w-full" onClick={retry}>
                        Проверить снова
                    </Button>
                </Card>
            </div>
        )
    }

    if (needsOnboarding) {
        return (
            <OnboardingScreen
                onDone={() => setNeedsOnboarding(false)}
                usedFallback={usedFallback}
                defaultDisplayName={user?.first_name ?? ''}
            />
        )
    }

    if (status === 'ready' && !needsOnboarding && location.pathname === '/login') {
        return <Navigate to="/" replace />
    }

    return (
        <>
            {usedFallback && (
                <div
                    className="border-b border-border bg-telegram-secondary-bg px-4 py-2 text-xs text-telegram-hint"
                    role="status"
                >
                    Авторизация выполнена через резервный канал. Для стабильной работы обновите Mini App при
                    возможности.
                </div>
            )}
            {children}
        </>
    )
}
