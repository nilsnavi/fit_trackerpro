import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import type { ActiveWorkoutRestTimerState } from '@/state/local'

interface RestTimerPanelProps {
    restTimer: ActiveWorkoutRestTimerState
    formatRestTime: (seconds: number) => string
    onPause: () => void
    onResume: () => void
    onRestart: () => void
    onSkip: () => void
}

export function RestTimerPanel({
    restTimer,
    formatRestTime,
    onPause,
    onResume,
    onRestart,
    onSkip,
}: RestTimerPanelProps) {
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
                    <Button type="button" variant="secondary" size="sm" leftIcon={<Play className="h-4 w-4" />} onClick={onResume}>
                        Продолжить
                    </Button>
                ) : (
                    <Button type="button" variant="secondary" size="sm" leftIcon={<Pause className="h-4 w-4" />} onClick={onPause}>
                        Пауза
                    </Button>
                )}
                <Button type="button" variant="secondary" size="sm" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={onRestart}>
                    Restart
                </Button>
                <Button type="button" variant="secondary" size="sm" leftIcon={<SkipForward className="h-4 w-4" />} onClick={onSkip}>
                    Skip
                </Button>
            </div>
        </div>
    )
}
