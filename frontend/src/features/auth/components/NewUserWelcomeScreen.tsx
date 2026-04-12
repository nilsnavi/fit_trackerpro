import { useCallback, useState } from 'react'

import { getErrorMessage } from '@shared/errors'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'
import { registerTelegramInitData, type TelegramExchangeResult } from '@/hooks/useTelegramAuth'

export type NewUserWelcomeScreenProps = {
    /** Raw string from `window.Telegram.WebApp.initData` */
    initData: string
    /** Telegram user first name when available */
    firstName?: string
    onRegistered: (result: TelegramExchangeResult) => void
}

/**
 * First-open welcome before account creation: short pitch + register via POST /users/auth/register.
 */
export function NewUserWelcomeScreen({ initData, firstName = '', onRegistered }: NewUserWelcomeScreenProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const greeting = firstName.trim() || 'друг'

    const handleStart = useCallback(async () => {
        setError(null)
        const raw = initData.trim()
        if (!raw) {
            setError('Нет данных Telegram. Закройте и снова откройте Mini App из бота.')
            return
        }
        setIsSubmitting(true)
        try {
            const result = await registerTelegramInitData(raw)
            onRegistered(result)
        } catch (e) {
            setError(getErrorMessage(e))
        } finally {
            setIsSubmitting(false)
        }
    }, [initData, onRegistered])

    return (
        <div className="flex min-h-dvh items-center justify-center p-4">
            <Card variant="info" className="w-full max-w-md">
                <h1 className="text-lg font-semibold text-telegram-text">Привет, {greeting}!</h1>
                <p className="mt-2 text-sm text-telegram-hint">
                    FitTracker Pro помогает вести тренировки и видеть прогресс в одном месте.
                </p>
                <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-telegram-text">
                    <li>Планы тренировок и шаблоны под ваши цели</li>
                    <li>Учёт подходов, весов и аналитика нагрузки</li>
                    <li>Здоровье и метрики рядом с тренировочным дневником</li>
                </ul>

                {error && (
                    <p className="mt-3 text-sm text-danger" role="alert">
                        {error}
                    </p>
                )}

                <Button
                    type="button"
                    className="mt-4 w-full"
                    isLoading={isSubmitting}
                    onClick={() => void handleStart()}
                >
                    Начать
                </Button>
            </Card>
        </div>
    )
}
