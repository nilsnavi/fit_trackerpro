import { memo, useEffect, useRef } from 'react'
import { Button } from '@shared/ui/Button'
import { useWorkoutSessionUiStore } from '@/stores/workoutSessionUiStore'

const R = 52
const CIRC = 2 * Math.PI * R

type WorkoutSessionRestOverlayProps = {
    onTimerEnd: (exerciseIndex: number) => void
}

/**
 * Полноэкранный оверлей отдыха: кольцо SVG по remaining/total, интервал через ref.
 */
export const WorkoutSessionRestOverlay = memo(function WorkoutSessionRestOverlay({
    onTimerEnd,
}: WorkoutSessionRestOverlayProps) {
    const sessionRestTimer = useWorkoutSessionUiStore((s) => s.sessionRestTimer)
    const tickSessionRestTimer = useWorkoutSessionUiStore((s) => s.tickSessionRestTimer)
    const skipSessionRestTimer = useWorkoutSessionUiStore((s) => s.skipSessionRestTimer)

    const sessionKeyRef = useRef<string | null>(null)
    const endedRef = useRef(false)

    useEffect(() => {
        if (!sessionRestTimer) {
            sessionKeyRef.current = null
            endedRef.current = false
            return
        }
        const key = `${sessionRestTimer.forExerciseId}-${sessionRestTimer.total}`
        if (sessionKeyRef.current !== key) {
            sessionKeyRef.current = key
            endedRef.current = false
        }
    }, [sessionRestTimer])

    useEffect(() => {
        if (!sessionRestTimer || sessionRestTimer.remaining <= 0) return
        const id = window.setInterval(() => {
            tickSessionRestTimer()
        }, 1000)
        return () => window.clearInterval(id)
    }, [sessionRestTimer?.forExerciseId, sessionRestTimer?.total, tickSessionRestTimer])

    useEffect(() => {
        if (!sessionRestTimer) return
        if (sessionRestTimer.remaining > 0) return
        if (endedRef.current) return
        endedRef.current = true
        const ix = sessionRestTimer.exerciseIndex
        skipSessionRestTimer()
        onTimerEnd(ix)
    }, [sessionRestTimer, onTimerEnd, skipSessionRestTimer])

    if (!sessionRestTimer) {
        return null
    }

    const { remaining, total, exerciseName, nextSetOrdinal, totalSets } = sessionRestTimer
    const ratio = total > 0 ? remaining / total : 0
    const offset = CIRC * (1 - ratio)

    const handleSkip = () => {
        const ix = sessionRestTimer.exerciseIndex
        skipSessionRestTimer()
        onTimerEnd(ix)
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-telegram-bg/85 px-6 backdrop-blur-sm"
            style={{ pointerEvents: 'auto' }}
            aria-modal
            role="dialog"
        >
            <p className="text-sm font-medium text-telegram-hint">Отдых</p>
            <p className="mt-1 max-w-[min(100%,24rem)] text-center text-lg font-bold leading-snug text-telegram-text">
                {exerciseName}
            </p>
            <p className="mt-2 text-sm text-telegram-hint">
                Следующий подход: {nextSetOrdinal} из {totalSets}
            </p>

            <div className="relative mt-8 flex h-48 w-48 items-center justify-center">
                <svg width={200} height={200} viewBox="0 0 120 120" className="-rotate-90">
                    <circle
                        cx="60"
                        cy="60"
                        r={R}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-telegram-hint/25"
                    />
                    <circle
                        cx="60"
                        cy="60"
                        r={R}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={CIRC}
                        strokeDashoffset={offset}
                        className="text-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold tabular-nums text-telegram-text">{remaining}</span>
                    <span className="mt-1 text-sm text-telegram-hint">секунд</span>
                </div>
            </div>

            <Button type="button" variant="secondary" className="mt-10 w-full max-w-sm" onClick={handleSkip}>
                Пропустить отдых
            </Button>
        </div>
    )
})

WorkoutSessionRestOverlay.displayName = 'WorkoutSessionRestOverlay'
