import { useCallback, useMemo, useState } from 'react'

import {
    authApi,
    type ExperienceLevel,
    type FitnessGoal,
} from '@features/profile/api/authApi'
import { getPublicApiBaseUrl } from '@shared/config/runtime'
import { getErrorMessage } from '@shared/errors'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'
import { getAuthTokens } from '@/stores/authStore'

export type OnboardingScreenProps = {
    onDone: () => void
    usedFallback?: boolean
    /** Pre-filled from Telegram `user.first_name` when available */
    defaultDisplayName?: string
}

async function saveOnboardingFetch(payload: {
    fitness_goal: FitnessGoal
    experience_level: ExperienceLevel
}): Promise<void> {
    const { accessToken } = getAuthTokens()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
    }
    const base = getPublicApiBaseUrl().replace(/\/$/, '')
    const response = await fetch(`${base}/users/auth/onboarding`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { detail?: string; error?: { message?: string } }
        const msg =
            (typeof data.error === 'object' && data.error?.message) ||
            data.detail ||
            `HTTP ${response.status}`
        throw new Error(String(msg))
    }
}

/**
 * First-run onboarding: display name, training goal, experience level.
 */
export function OnboardingScreen({ onDone, usedFallback, defaultDisplayName = '' }: OnboardingScreenProps) {
    const [displayName, setDisplayName] = useState(defaultDisplayName)
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
            const trimmed = displayName.trim()
            if (trimmed.length > 0) {
                try {
                    await authApi.updateCurrentUser({ first_name: trimmed })
                } catch (e) {
                    setError(getErrorMessage(e))
                    return
                }
            }

            const payload = { fitness_goal: fitnessGoal, experience_level: experienceLevel }
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
    }, [displayName, experienceLevel, fitnessGoal, onDone])

    return (
        <div className="flex min-h-dvh items-center justify-center p-4">
            <Card variant="info" className="w-full max-w-md">
                <h1 className="text-lg font-semibold text-telegram-text">Добро пожаловать в FitTracker Pro</h1>
                <p className="mt-2 text-sm text-telegram-hint">
                    Заполните короткий онбординг: как к вам обращаться, цель и уровень подготовки.
                </p>
                {usedFallback && (
                    <p className="mt-2 text-xs text-telegram-hint" role="status">
                        Использован резервный канал авторизации.
                    </p>
                )}

                <label className="mt-4 block">
                    <span className="text-sm font-medium text-telegram-text">Имя</span>
                    <input
                        type="text"
                        name="display_name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={255}
                        placeholder="Как вас называть"
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </label>

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
