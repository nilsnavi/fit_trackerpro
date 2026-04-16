import { Plus, Timer, Check } from 'lucide-react'
import { WorkoutActionRail } from '@features/workouts/components/WorkoutActionRail'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import type { AddItemKind } from '../lib/activeWorkoutUtils'
import { FALLBACK_REST_PRESETS_SECONDS } from '../lib/activeWorkoutUtils'

export interface ActiveWorkoutBottomActionsProps {
    isActiveDraft: boolean
    restPresets: number[]
    restDefaultSeconds: number
    currentExercise: CompletedExercise | null
    isFinishing: boolean
    onSelectRestPreset: (seconds: number) => void
    onAddItem: (kind: AddItemKind) => void
    onRemoveSet: () => void
    onAddSet: () => void
    onFinishWorkout: () => void
    /** Когда кнопка завершения вынесена в основной layout (верх страницы) */
    hideFinishButton?: boolean
    /** Показывать Floating Action Button для завершения подхода */
    showCompleteSetFAB?: boolean
    onCompleteSet?: () => void
}

export function ActiveWorkoutBottomActions({
    isActiveDraft,
    restPresets,
    restDefaultSeconds,
    currentExercise,
    isFinishing,
    onSelectRestPreset,
    onAddItem,
    onRemoveSet,
    onAddSet,
    onFinishWorkout,
    hideFinishButton = false,
    showCompleteSetFAB = false,
    onCompleteSet,
}: ActiveWorkoutBottomActionsProps) {
    if (!isActiveDraft) return null

    /* PR UX note: before — collapsible rail started hidden (~20px handle), so +set/finish needed swipe-up every time.
       after — rail starts expanded; user can still collapse via handle / swipe-down for more list space. */
    return (
        <>
            {/* Floating Action Button для завершения подхода */}
            {showCompleteSetFAB && onCompleteSet && (
                <button
                    type="button"
                    onClick={onCompleteSet}
                    className="fixed bottom-24 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95"
                    aria-label="Завершить подход"
                >
                    <Check className="h-7 w-7" />
                </button>
            )}

            <WorkoutActionRail
                collapsible
                defaultCollapsed={false}
                className="space-y-2"
                topSlot={(
                    <>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            <span className="shrink-0 text-[11px] text-telegram-hint">Отдых:</span>
                            {(restPresets.length > 0 ? restPresets : FALLBACK_REST_PRESETS_SECONDS).map((seconds) => (
                                <button
                                    key={`sticky-rest-${seconds}`}
                                    type="button"
                                    onClick={() => onSelectRestPreset(seconds)}
                                    className={`min-h-[44px] min-w-[56px] shrink-0 touch-manipulation rounded-full px-4 py-2.5 text-sm font-medium ${restDefaultSeconds === seconds
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
                            leftIcon: <Plus className="h-5 w-5" />,
                            onClick: () => onAddItem('exercise'),
                            className: 'min-h-[56px]', // Large touch target
                        },
                        {
                            id: 'add-timer',
                            label: 'Таймер',
                            variant: 'secondary',
                            leftIcon: <Timer className="h-5 w-5" />,
                            onClick: () => onAddItem('timer'),
                            className: 'min-h-[56px]',
                        },
                    ],
                    [
                        {
                            id: 'remove-set',
                            label: '- Подход',
                            variant: 'secondary',
                            onClick: onRemoveSet,
                            disabled: !currentExercise || currentExercise.sets_completed.length <= 1,
                            className: 'min-h-[56px]',
                        },
                        {
                            id: 'add-set',
                            label: '+ Подход',
                            variant: 'secondary',
                            onClick: onAddSet,
                            disabled: !currentExercise,
                            className: 'min-h-[56px]',
                        },
                    ],
                    ...(hideFinishButton
                        ? []
                        : [
                            [
                                {
                                    id: 'finish-workout',
                                    label: 'Завершить тренировку',
                                    onClick: onFinishWorkout,
                                    disabled: isFinishing,
                                    isLoading: isFinishing,
                                    className: 'w-full min-h-[56px]',
                                    'data-testid': 'finish-workout-btn',
                                },
                            ],
                        ]),
                ]}
            />
        </>
    )
}

