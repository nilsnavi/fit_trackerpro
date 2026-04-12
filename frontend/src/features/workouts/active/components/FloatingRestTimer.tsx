/**
 * PR UX: плавающий таймер привязан к `var(--app-shell-nav-h)` + запас под нижний action rail,
 * чтобы expanded/minimized не перекрывались кнопками «+ подход» / «Завершить».
 */
import { memo, useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { useActiveWorkoutActions, useActiveWorkoutStore } from '@/state/local'
import { useRestTimer } from '@features/workouts/active/hooks/useRestTimer'
import { formatDurationParts, useRestElapsedSeconds } from '@features/workouts/active/hooks/useWorkoutTimer'

interface FloatingRestTimerProps {
    className?: string
}

export const FloatingRestTimer = memo(function FloatingRestTimer({
    className = '',
}: FloatingRestTimerProps) {
    const restTimer = useActiveWorkoutStore((s) => s.restTimer)
    const {
        tickRestTimer,
        skipRestTimer,
        pauseRestTimer,
        resumeRestTimer,
        restartRestTimer,
    } = useActiveWorkoutActions()
    const [isMinimized, setIsMinimized] = useState(false)

    const { formatRestTime } = useRestTimer({
        isRunning: restTimer.isRunning,
        isPaused: restTimer.isPaused,
        remainingSeconds: restTimer.remainingSeconds,
        durationSeconds: restTimer.durationSeconds,
        tick: tickRestTimer,
    })
    const elapsedSeconds = useRestElapsedSeconds(restTimer.durationSeconds, restTimer.remainingSeconds)
    const elapsedParts = formatDurationParts(elapsedSeconds)

    // Auto-minimize after 5 seconds
    useEffect(() => {
        if (!restTimer.isRunning && !restTimer.isPaused) return

        const timeoutId = setTimeout(() => {
            setIsMinimized(true)
        }, 5000)

        return () => clearTimeout(timeoutId)
    }, [restTimer.isRunning, restTimer.isPaused])

    if (!restTimer.isRunning && !restTimer.isPaused) {
        return null
    }

    // Minimized view - compact floating timer
    if (isMinimized) {
        return (
            <div
                className={`fixed bottom-[calc(var(--app-shell-nav-h)+10.5rem)] right-4 z-30 ${className}`}
                onClick={() => setIsMinimized(false)}
            >
                <div className="flex items-center gap-2 rounded-full bg-primary px-3 py-2 shadow-lg">
                    <Timer className="h-4 w-4 text-primary-foreground" />
                    <span className="text-sm font-semibold text-primary-foreground">
                        {formatRestTime(restTimer.remainingSeconds)}
                    </span>
                    <span className="text-[10px] text-primary-foreground/80">
                        ↓{elapsedParts.minutes}:{String(elapsedParts.seconds).padStart(2, '0')}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            skipRestTimer()
                        }}
                        className="ml-1 rounded-full bg-primary-foreground/20 p-1"
                        aria-label="Skip rest"
                    >
                        <SkipForward className="h-3.5 w-3.5 text-primary-foreground" />
                    </button>
                </div>
            </div>
        )
    }

    // Expanded view — не модалка: оверлей поверх контента, логирование не блокируется
    return (
        <div className={`fixed bottom-[calc(var(--app-shell-nav-h)+11.5rem)] left-4 right-4 z-30 ${className}`}>
            <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-4 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-telegram-hint">Отдых</p>
                        <p className="text-2xl font-bold tabular-nums text-telegram-text">
                            {formatRestTime(restTimer.remainingSeconds)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-telegram-hint">
                            Прошло: {elapsedParts.minutes} мин {elapsedParts.seconds} сек ·{' '}
                            {restTimer.isPaused ? 'пауза' : 'идёт'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            className="min-h-[44px] touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint"
                        >
                            Свернуть
                        </button>
                        {restTimer.isPaused ? (
                            <button
                                type="button"
                                onClick={resumeRestTimer}
                                className="inline-flex min-h-[44px] items-center gap-1 touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-semibold text-telegram-text"
                            >
                                <Play className="h-4 w-4" />
                                Дальше
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={pauseRestTimer}
                                className="inline-flex min-h-[44px] items-center gap-1 touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-semibold text-telegram-text"
                            >
                                <Pause className="h-4 w-4" />
                                Пауза
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={restartRestTimer}
                            className="inline-flex min-h-[44px] items-center gap-1 touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-semibold text-telegram-text"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Сброс
                        </button>
                        <button
                            type="button"
                            onClick={skipRestTimer}
                            className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                        >
                            Пропустить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
})

FloatingRestTimer.displayName = 'FloatingRestTimer'

