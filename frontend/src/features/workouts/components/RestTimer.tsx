/**
 * RestTimer Component
 * 
 * Компонент таймера отдыха между подходами.
 * Использует хук useRestTimer для логики.
 */

import { Clock, SkipForward, Play, Pause, RotateCcw } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { hapticTimerSkip, hapticButtonLight } from '@features/telegram'
import { useRestTimer } from '../hooks/useRestTimer'
import React from 'react'

interface RestTimerProps {
    initialSeconds?: number
    onComplete?: () => void
    className?: string
}

export function RestTimer({ initialSeconds = 90, onComplete, className }: RestTimerProps) {
    const { seconds, isActive, formattedTime, progress, start, stop, reset, skip } =
        useRestTimer({
            initialSeconds,
            onComplete,
        })

    const handleSkip = () => {
        // Light impact при пропуске таймера
        hapticTimerSkip()
        skip()
    }

    const handleStart = () => {
        // Light impact при старте таймера
        hapticButtonLight()
        start()
    }

    return (
        <div className={cn('rounded-xl bg-telegram-secondary-bg p-4', className)}>
            {/* Заголовок */}
            <div className="mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-telegram-text">Отдых</h3>
            </div>

            {/* Время и прогресс */}
            <div className="mb-4">
                <div className="text-center">
                    <p className="text-4xl font-bold text-telegram-text">{formattedTime}</p>
                    <p className="mt-1 text-xs text-telegram-hint">
                        {isActive ? 'Идет отдых...' : 'Готов к тренировке'}
                    </p>
                </div>

                {/* Прогресс-бар */}
                <div className="mt-3 h-2 rounded-full bg-telegram-bg overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Кнопки управления */}
            <div className="flex items-center justify-center gap-3">
                {!isActive ? (
                    <button
                        type="button"
                        onClick={handleStart}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                        <Play className="h-4 w-4" />
                        Старт
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={stop}
                            className="flex items-center gap-2 rounded-lg bg-telegram-bg px-4 py-2 text-sm font-medium text-telegram-text transition-colors hover:bg-telegram-secondary-bg"
                        >
                            <Pause className="h-4 w-4" />
                            Пауза
                        </button>
                        <button
                            type="button"
                            onClick={handleSkip}
                            className="flex items-center gap-2 rounded-lg bg-telegram-bg px-4 py-2 text-sm font-medium text-telegram-text transition-colors hover:bg-telegram-secondary-bg"
                        >
                            <SkipForward className="h-4 w-4" />
                            Пропустить
                        </button>
                    </>
                )}

                <button
                    type="button"
                    onClick={() => reset()}
                    className="rounded-lg bg-telegram-bg px-3 py-2 text-sm font-medium text-telegram-hint transition-colors hover:bg-telegram-secondary-bg hover:text-telegram-text"
                    aria-label="Сбросить"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {/* Быстрый выбор времени */}
            <div className="mt-4 flex items-center justify-center gap-2">
                {[30, 60, 90, 120].map((secs) => (
                    <button
                        key={secs}
                        type="button"
                        onClick={() => {
                            hapticButtonLight()
                            reset(secs)
                        }}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            seconds === secs && !isActive
                                ? 'bg-primary/10 text-primary'
                                : 'bg-telegram-bg text-telegram-hint hover:bg-telegram-secondary-bg',
                        )}
                    >
                        {secs}с
                    </button>
                ))}
            </div>
        </div>
    )
}

RestTimer.displayName = 'RestTimer'

export default RestTimer
