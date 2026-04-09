import { ArrowLeft } from 'lucide-react'
import type { WorkoutSyncIndicatorState } from '@features/workouts/active/components/WorkoutSyncIndicator'
import { WorkoutSyncIndicator } from '@features/workouts/active/components/WorkoutSyncIndicator'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface ActiveWorkoutHeaderProps {
    onBack: () => void
    syncState?: ActiveWorkoutSyncState | WorkoutSyncIndicatorState
    /** Passed through to WorkoutSyncIndicator for offline queue count display. */
    pendingCount?: number
}

export function ActiveWorkoutHeader({ onBack, syncState, pendingCount }: ActiveWorkoutHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-11 w-11 touch-manipulation shrink-0 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text active:bg-telegram-secondary-bg/70"
                    aria-label="Назад к тренировкам"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="truncate text-lg font-bold text-telegram-text sm:text-xl">Активная тренировка</h1>
            </div>
            {syncState && <WorkoutSyncIndicator state={syncState} pendingCount={pendingCount} />}
        </div>
    )
}
