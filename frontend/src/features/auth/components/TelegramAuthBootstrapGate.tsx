import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'

import { useTelegramContext } from '@app/providers/TelegramProvider'
import {
    authApi,
    type ExperienceLevel,
    type FitnessGoal,
} from '@features/profile/api/authApi'
import { getErrorMessage } from '@shared/errors'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'
import { getAuthTokens, useAuthStore } from '@/stores/authStore'

type BootstrapStatus = 'loading' | 'ready' | 'error' | 'no_telegram' | 'expired'

type TelegramLoginFallbackResponse = {
    access_token: string
    refresh_token?: string | null
    onboarding_required: boolean
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

async function saveOnboardingFetch(payload: {
    fitness_goal: FitnessGoal
    experience_level: ExperienceLevel
}): Promise<void> {
    const { accessToken } = getAuthTokens()
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await fetch(`${getApiBaseUrl()}/users/auth/onboarding`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { detail?: string }
        throw new Error(data.detail || `HTTP ${response.status}`)
    }
}

export function TelegramAuthBootstrapGate({ children }: PropsWithChildren) {
    const { isTelegram, initData, hapticFeedback } = useTelegramContext()
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const setTokens = useAuthStore((s) => s.setTokens)
    const clearAuth = useAuthStore((s) => s.clear)

    const [status, setStatus] = useState<BootstrapStatus>('loading')
    const [error, setError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [usedFallback, setUsedFallback] = useState(false)

    const [needsOnboarding, setNeedsOnboarding] = useState(false)

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

        if (!isTelegram || !initData) {
            setStatus('no_telegram')
            return
        }

        try {
            const result = await telegramLoginSafe(initData)
            const response = result.data
            setUsedFallback(result.via === 'fetch')
            if (!response.access_token) {
                throw new Error('Не получен access_token')
            }
            setTokens({ accessToken: response.access_token, refreshToken: response.refresh_token })
            setNeedsOnboarding(response.onboarding_required)
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

    // Listen for session-expired events dispatched by the API client interceptor.
    // This lets us re-authenticate transparently inside Telegram Mini App instead
    // of hard-redirecting to /login.
    useEffect(() => {
        const handleExpired = () => {
            clearAuth()
            setStatus('expired')
            // Auto-retry after a short delay to give a visual cue
            const timer = setTimeout(() => setAttempt((v) => v + 1), 1200)
            return () => clearTimeout(timer)
        }
        window.addEventListener('auth:session-expired', handleExpired)
        return () => window.removeEventListener('auth:session-expired', handleExpired)
    }, [clearAuth])

    const retry = useCallback(() => {
        setAttempt((value) => value + 1)
    }, [])

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
                    <p className="mt-2 text-sm text-telegram-hint">
                        Восстанавливаем подключение...
                    </p>
                    <Button type="button" variant="secondary" className="mt-4 w-full" onClick={retry}>
                        Повторить вход
                    </Button>
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
        return <OnboardingStep onDone={() => setNeedsOnboarding(false)} usedFallback={usedFallback} />
    }

    return (
        <>
            {usedFallback && (
                <div className="border-b border-border bg-telegram-secondary-bg px-4 py-2 text-xs text-telegram-hint" role="status">
                    Авторизация выполнена через резервный канал. Для стабильной работы обновите Mini App при возможности.
                </div>
            )}
            {children}
        </>
    )
}

function OnboardingStep({ onDone, usedFallback }: { onDone: () => void; usedFallback: boolean }) {
    const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('strength')
    const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const goalOptions = useMemo(
        () => [
            { value: 'strength' as const, label: 'Сила' },
            { value: 'weight_loss' as const, label: 'Снижение веса' },
            { value: 'endurance' as const, label: 'Выносливость' },
        ],
        [],
    )

    const levelOptions = useMemo(
        () => [
            { value: 'beginner' as const, label: 'Начинающий' },
            { value: 'intermediate' as const, label: 'Средний' },
            { value: 'advanced' as const, label: 'Продвинутый' },
        ],
        [],
    )

    const handleSubmit = useCallback(async () => {
        setError(null)
        setIsSubmitting(true)
        try {
            const payload = {
                fitness_goal: fitnessGoal,
                experience_level: experienceLevel,
            }
            try {
                await authApi.saveOnboarding(payload)
            } catch {
                await saveOnboardingFetch(payload)
            }
            onDone()
        } catch (e) {
            setError(getErrorMessage(e))
        } finally {
            setIsSubmitting(false)
        }
    }, [experienceLevel, fitnessGoal, onDone])

    return (
        <div className="flex min-h-dvh items-center justify-center p-4">
            <Card variant="info" className="w-full max-w-md">
                <h1 className="text-lg font-semibold text-telegram-text">Добро пожаловать в FitTracker Pro</h1>
                <p className="mt-2 text-sm text-telegram-hint">
                    Заполните короткий onboarding, чтобы мы персонализировали план тренировок.
                </p>
                {usedFallback && (
                    <p className="mt-2 text-xs text-telegram-hint" role="status">
                        Использован резервный канал авторизации.
                    </p>
                )}

                <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-telegram-text">Цель тренировок</legend>
                    <div className="mt-2 space-y-2">
                        {goalOptions.map((option) => (
                            <label
                                key={option.value}
                                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                            >
                                <input
                                    type="radio"
                                    name="fitness_goal"
                                    value={option.value}
                                    checked={fitnessGoal === option.value}
                                    onChange={() => setFitnessGoal(option.value)}
                                />
                                <span className="text-sm text-telegram-text">{option.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-telegram-text">Уровень подготовки</legend>
                    <div className="mt-2 space-y-2">
                        {levelOptions.map((option) => (
                            <label
                                key={option.value}
                                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                            >
                                <input
                                    type="radio"
                                    name="experience_level"
                                    value={option.value}
                                    checked={experienceLevel === option.value}
                                    onChange={() => setExperienceLevel(option.value)}
                                />
                                <span className="text-sm text-telegram-text">{option.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {error && (
                    <p className="mt-3 text-sm text-danger" role="alert">
                        {error}
                    </p>
                )}

                <Button
                    type="button"
                    className="mt-4 w-full"
                    isLoading={isSubmitting}
                    onClick={() => void handleSubmit()}
                >
                    Сохранить и продолжить
                </Button>
            </Card>
        </div>
    )
}
