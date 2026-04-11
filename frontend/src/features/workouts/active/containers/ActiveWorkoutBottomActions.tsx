import { Plus, Timer } from 'lucide-react'
import { WorkoutActionRail } from '@features/workouts/components/WorkoutActionRail'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import type { AddItemKind } from '../lib/activeWorkoutUtils'
import { FALLBACK_REST_PRESETS_SECONDS } from '../lib/activeWorkoutUtils'

export interface ActiveWorkoutBottomActionsProps {
    isActiveDraft: boolean
    completedSetCount: number
    totalSetCount: number
    restPresets: number[]
    restDefaultSeconds: number
    currentExercise: CompletedExercise | null
    isFinishing: boolean
    onSelectRestPreset: (seconds: number) => void
    onAddItem: (kind: AddItemKind) => void
    onRemoveSet: () => void
    onAddSet: () => void
    onFinishWorkout: () => void
}

export function ActiveWorkoutBottomActions({
    isActiveDraft,
    completedSetCount,
    totalSetCount,
    restPresets,
    restDefaultSeconds,
    currentExercise,
    isFinishing,
    onSelectRestPreset,
    onAddItem,
    onRemoveSet,
    onAddSet,
    onFinishWorkout,
}: ActiveWorkoutBottomActionsProps) {
    if (!isActiveDraft) return null

    /* PR UX note: before — collapsible rail started hidden (~20px handle), so +set/finish needed swipe-up every time.
       after — rail starts expanded; user can still collapse via handle / swipe-down for more list space. */
    return (
        <WorkoutActionRail
            collapsible
            defaultCollapsed={false}
            className="space-y-2"
            topSlot={(
                <>
                    <div className="flex items-center justify-between rounded-lg bg-telegram-secondary-bg px-3 py-2">
                        <p className="text-xs text-telegram-hint">Прогресс сессии</p>
                        <p className="text-sm font-semibold text-telegram-text">
                            {completedSetCount}/{totalSetCount} подходов
                        </p>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <span className="shrink-0 text-[11px] text-telegram-hint">Отдых:</span>
                        {(restPresets.length > 0 ? restPresets : FALLBACK_REST_PRESETS_SECONDS).map((seconds) => (
                            <button
                                key={`sticky-rest-${seconds}`}
                                type="button"
                                onClick={() => onSelectRestPreset(seconds)}
                                className={`min-h-10 shrink-0 touch-manipulation rounded-full px-3 py-2 text-xs font-medium ${restDefaultSeconds === seconds
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-telegram-secondary-bg text-telegram-text'
                                    }`}
                            >
                                {seconds < 60 ? `${seconds}с` : `${Math.floor(seconds / 60)}м`}
                            </button>
                        ))}
                    </div>
                </>
            )}
            sections={[
                [
                    {
                        id: 'add-exercise',
                        label: 'Упражнение',
                        variant: 'secondary',
                        leftIcon: <Plus className="h-4 w-4" />,
                        onClick: () => onAddItem('exercise'),
                    },
                    {
                        id: 'add-timer',
                        label: 'Таймер',
                        variant: 'secondary',
                        leftIcon: <Timer className="h-4 w-4" />,
                        onClick: () => onAddItem('timer'),
                    },
                ],
                [
                    {
                        id: 'remove-set',
                        label: '- Подход',
                        variant: 'secondary',
                        onClick: onRemoveSet,
                        disabled: !currentExercise || currentExercise.sets_completed.length <= 1,
                    },
                    {
                        id: 'add-set',
                        label: '+ Подход',
                        variant: 'secondary',
                        onClick: onAddSet,
                        disabled: !currentExercise,
                    },
                ],
                [
                    {
                        id: 'finish-workout',
                        label: 'Завершить тренировку',
                        onClick: onFinishWorkout,
                        disabled: isFinishing,
                        isLoading: isFinishing,
                        className: 'w-full',
                        'data-testid': 'finish-workout-btn',
                    },
                ],
            ]}
        />
    )
}

