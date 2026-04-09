import { memo } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { useActiveWorkoutActions, useActiveWorkoutStore } from '@/state/local'
import { useRestTimer } from '@features/workouts/active/hooks/useRestTimer'

export const RestTimerPanel = memo(function RestTimerPanel() {
    const restTimer = useActiveWorkoutStore((s) => s.restTimer)
    const {
        tickRestTimer,
        pauseRestTimer,
        resumeRestTimer,
        restartRestTimer,
        skipRestTimer,
    } = useActiveWorkoutActions()

    const { formatRestTime } = useRestTimer({
        isRunning: restTimer.isRunning,
        isPaused: restTimer.isPaused,
        remainingSeconds: restTimer.remainingSeconds,
        durationSeconds: restTimer.durationSeconds,
        tick: tickRestTimer,
    })

    if (!restTimer.isRunning && !restTimer.isPaused) {
        return null
    }

    return (
        <div className="rounded-xl border border-border bg-telegram-secondary-bg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-xs text-telegram-hint">Отдых</p>
                    <p className="text-lg font-semibold text-telegram-text">{formatRestTime(restTimer.remainingSeconds)}</p>
                </div>
                <span className="text-xs text-telegram-hint">{restTimer.isPaused ? 'Пауза' : 'Идёт'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {restTimer.isPaused ? (
                    <Button type="button" variant="secondary" size="md" leftIcon={<Play className="h-4 w-4" />} onClick={resumeRestTimer}>
                        Продолжить
                    </Button>
                ) : (
                    <Button type="button" variant="secondary" size="md" leftIcon={<Pause className="h-4 w-4" />} onClick={pauseRestTimer}>
                        Пауза
                    </Button>
                )}
                <Button type="button" variant="secondary" size="md" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={restartRestTimer}>
                    Сбросить
                </Button>
                <Button type="button" variant="secondary" size="md" leftIcon={<SkipForward className="h-4 w-4" />} onClick={skipRestTimer}>
                    Пропустить
                </Button>
            </div>
        </div>
    )
})

RestTimerPanel.displayName = 'RestTimerPanel'
