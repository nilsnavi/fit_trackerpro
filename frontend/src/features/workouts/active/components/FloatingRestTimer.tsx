/**
 * PR UX: плавающий таймер привязан к `var(--app-shell-nav-h)` + запас под нижний action rail,
 * чтобы expanded/minimized не перекрывались кнопками «+ подход» / «Завершить».
 */
import { memo, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { useActiveWorkoutActions, useActiveWorkoutStore } from '@/state/local'
import { useRestTimer } from '@features/workouts/active/hooks/useRestTimer'
import { formatDurationParts, useRestElapsedSeconds } from '@features/workouts/active/hooks/useWorkoutTimer'
import type { CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'

interface FloatingRestTimerProps {
    className?: string
    workout?: WorkoutHistoryItem | null
    onUpdateSet?: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
}

export const FloatingRestTimer = memo(function FloatingRestTimer({
    className = '',
    workout = null,
    onUpdateSet,
}: FloatingRestTimerProps) {
    const restTimer = useActiveWorkoutStore((s) => s.restTimer)
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const lastCompletedSet = useActiveWorkoutStore((s) => s.lastCompletedSet)
    const {
        tickRestTimer,
        skipRestTimer,
        pauseRestTimer,
        resumeRestTimer,
        restartRestTimer,
        startRestTimer,
        setRestDefaultSeconds,
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
    const trackedRestSeconds =
        restTimer.durationSeconds > 0 ? Math.max(0, restTimer.durationSeconds - restTimer.remainingSeconds) : 0
    const didAutoSaveRef = useRef(false)

    useEffect(() => {
        // reset autosave guard on new timer start
        if (restTimer.durationSeconds > 0 && restTimer.remainingSeconds === restTimer.durationSeconds) {
            didAutoSaveRef.current = false
        }
    }, [restTimer.durationSeconds, restTimer.remainingSeconds])

    const lastSet: CompletedSet | null = (() => {
        if (!workout || !lastCompletedSet) return null
        const ex = workout.exercises?.[lastCompletedSet.exerciseIndex]
        if (!ex) return null
        return ex.sets_completed.find((s) => s.set_number === lastCompletedSet.setNumber) ?? null
    })()

    const rpeValue = typeof lastSet?.rpe === 'number' && Number.isFinite(lastSet.rpe) ? Math.round(lastSet.rpe) : 7
    const rpeLabel =
        rpeValue <= 3 ? 'Лёгко' : rpeValue <= 6 ? 'Средне' : rpeValue <= 9 ? 'Тяжело' : 'Максимум'

    // Auto-minimize after 5 seconds
    useEffect(() => {
        if (!restTimer.isRunning && !restTimer.isPaused) return

        const timeoutId = setTimeout(() => {
            setIsMinimized(true)
        }, 5000)

        return () => clearTimeout(timeoutId)
    }, [restTimer.isRunning, restTimer.isPaused])

    useEffect(() => {
        if (!onUpdateSet || !lastCompletedSet) return
        if (didAutoSaveRef.current) return
        if (!(restTimer.isPaused && restTimer.remainingSeconds <= 0 && restTimer.durationSeconds > 0)) return
        didAutoSaveRef.current = true
        onUpdateSet(lastCompletedSet.exerciseIndex, lastCompletedSet.setNumber, {
            rest_seconds: restTimer.durationSeconds,
        })
    }, [
        lastCompletedSet,
        onUpdateSet,
        restTimer.durationSeconds,
        restTimer.isPaused,
        restTimer.remainingSeconds,
    ])

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
                            if (onUpdateSet && lastCompletedSet) {
                                onUpdateSet(lastCompletedSet.exerciseIndex, lastCompletedSet.setNumber, {
                                    rest_seconds: trackedRestSeconds,
                                })
                            }
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
                            onClick={() => {
                                if (onUpdateSet && lastCompletedSet) {
                                    onUpdateSet(lastCompletedSet.exerciseIndex, lastCompletedSet.setNumber, {
                                        rest_seconds: trackedRestSeconds,
                                    })
                                }
                                skipRestTimer()
                            }}
                            className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                        >
                            Пропустить
                        </button>
                    </div>
                </div>

                <div className="mt-3 grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-telegram-bg/60 p-3">
                        <div>
                            <p className="text-[11px] text-telegram-hint">Длительность (по умолчанию)</p>
                            <p className="text-sm font-semibold text-telegram-text">{restDefaultSeconds} сек</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {[60, 90, 120].map((s) => (
                                <button
                                    key={`rest-preset-${s}`}
                                    type="button"
                                    onClick={() => {
                                        setRestDefaultSeconds(s)
                                        startRestTimer(s)
                                    }}
                                    className={`min-h-10 touch-manipulation rounded-xl px-3 py-2 text-xs font-semibold ${
                                        restDefaultSeconds === s
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'
                                    }`}
                                >
                                    {s}с
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    const next = Math.max(15, restTimer.durationSeconds - 15)
                                    setRestDefaultSeconds(next)
                                    startRestTimer(next)
                                }}
                                className="min-h-10 touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-semibold text-telegram-hint active:bg-telegram-secondary-bg"
                            >
                                −15
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = Math.min(600, restTimer.durationSeconds + 15)
                                    setRestDefaultSeconds(next)
                                    startRestTimer(next)
                                }}
                                className="min-h-10 touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-semibold text-telegram-hint active:bg-telegram-secondary-bg"
                            >
                                +15
                            </button>
                        </div>
                    </div>

                    {lastCompletedSet && onUpdateSet && lastSet ? (
                        <div className="rounded-xl border border-border bg-telegram-bg/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-[11px] text-telegram-hint">RPE после подхода</p>
                                    <p className="text-sm font-semibold text-telegram-text">
                                        {rpeValue} · {rpeLabel}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onUpdateSet(lastCompletedSet.exerciseIndex, lastCompletedSet.setNumber, {
                                            rest_seconds: trackedRestSeconds,
                                        })
                                    }}
                                    className="min-h-10 touch-manipulation rounded-xl bg-telegram-bg px-3 py-2 text-xs font-semibold text-telegram-hint active:bg-telegram-secondary-bg"
                                >
                                    Записать отдых
                                </button>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                step={1}
                                value={rpeValue}
                                onChange={(e) => {
                                    const next = Number.parseInt(e.target.value, 10)
                                    onUpdateSet(lastCompletedSet.exerciseIndex, lastCompletedSet.setNumber, {
                                        rpe: next,
                                        rest_seconds: trackedRestSeconds,
                                    })
                                }}
                                className="mt-3 w-full"
                                aria-label="RPE"
                            />
                            <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-telegram-hint">
                                <span>1–3 Лёгко</span>
                                <span className="text-center">4–6 Средне</span>
                                <span className="text-center">7–9 Тяжело</span>
                                <span className="text-right">10 Максимум</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
})

FloatingRestTimer.displayName = 'FloatingRestTimer'

