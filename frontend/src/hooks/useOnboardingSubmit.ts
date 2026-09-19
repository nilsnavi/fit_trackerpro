import { useCallback, useState } from 'react'

import {
    authApi,
    type ExperienceLevel,
    type FitnessGoal,
    type SaveOnboardingRequest,
} from '@features/profile/api/authApi'
import { getPublicApiBaseUrl } from '@shared/config/runtime'
import { getErrorMessage } from '@shared/errors'
import { getAuthTokens } from '@/stores/authStore'

export interface OnboardingAnswers {
    displayName: string
    fitnessGoal: FitnessGoal
    experienceLevel: ExperienceLevel
}

/** Резервный канал: тот же POST, если клиент API недоступен. */
async function saveOnboardingFetch(payload: SaveOnboardingRequest): Promise<void> {
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
 * Отправка онбординга: имя, цель, уровень. Владелец сетевой части первого запуска —
 * экран отдаёт ответы и получает состояние отправки.
 */
export function useOnboardingSubmit(onDone: () => void) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = useCallback(
        async ({ displayName, fitnessGoal, experienceLevel }: OnboardingAnswers) => {
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

                const payload: SaveOnboardingRequest = {
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
        },
        [onDone],
    )

    return { submit, isSubmitting, error }
}
