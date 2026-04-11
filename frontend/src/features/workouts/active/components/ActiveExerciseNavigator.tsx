import { memo } from 'react'

export interface ActiveExerciseNavigatorProps {
    exerciseLabels: readonly { key: string; name: string }[]
    currentExerciseIndex: number
    onSelectExercise: (exerciseIndex: number) => void
}

/**
 * Горизонтальная навигация по упражнениям без смены маршрута.
 */
export const ActiveExerciseNavigator = memo(function ActiveExerciseNavigator({
    exerciseLabels,
    currentExerciseIndex,
    onSelectExercise,
}: ActiveExerciseNavigatorProps) {
    if (exerciseLabels.length <= 1) return null

    return (
        <div className="sticky top-0 z-10 -mx-1 border-b border-border/60 bg-telegram-bg/95 py-2 backdrop-blur-sm px-1">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-telegram-hint">Упражнения</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {exerciseLabels.map((item, index) => {
                    const isCurrent = index === currentExerciseIndex
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => onSelectExercise(index)}
                            className={`min-h-11 max-w-[min(100%,14rem)] shrink-0 touch-manipulation rounded-full px-3.5 py-2 text-left text-xs font-semibold transition-colors ${isCurrent
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-telegram-secondary-bg text-telegram-text active:bg-telegram-bg'
                                }`}
                        >
                            <span className="line-clamp-2">{item.name}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
})

ActiveExerciseNavigator.displayName = 'ActiveExerciseNavigator'
