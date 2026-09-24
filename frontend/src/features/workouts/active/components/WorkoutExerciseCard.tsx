import { memo, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { getExerciseSummaryMeta, pluralizeRu } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import {
    deriveExerciseSessionState,
    type ExerciseSessionStatus,
} from '@features/workouts/active/lib/exerciseSessionDerivation'

function setDotClass(
    exerciseIndex: number,
    setIndex: number,
    currentExerciseIndex: number,
    currentSetIndex: number,
    setCompleted: boolean,
): string {
    if (setCompleted) return 'bg-emerald-500'
    if (exerciseIndex === currentExerciseIndex && setIndex === currentSetIndex) return 'bg-primary'
    if (exerciseIndex < currentExerciseIndex) return 'bg-emerald-500'
    if (exerciseIndex === currentExerciseIndex && setIndex < currentSetIndex) return 'bg-emerald-500'
    return 'bg-telegram-hint/25'
}

function buildMetaLine(exercise: CompletedExercise): string {
    const n = exercise.sets_completed.length
    const first = exercise.sets_completed[0]
    const parts: string[] = []
    if (n > 0) {
        parts.push(`${n}×`)
        if (first?.reps != null) {
            parts.push(`${first.reps} ${pluralizeRu(first.reps, ['повт', 'повта', 'повтов'])}`)
        }
        if (first?.duration != null && first.duration > 0) {
            parts.push(`${first.duration} сек`)
        }
        if (first?.weight != null) {
            parts.push(`${first.weight} кг`)
        }
    }
    return parts.join(' · ')
}

function statusBadge(status: ExerciseSessionStatus): { label: string; className: string } {
    if (status === 'current') {
        return { label: 'Текущее', className: 'bg-primary/15 text-primary border border-primary/35' }
    }
    if (status === 'done') {
        return { label: 'Выполнено ✓', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35' }
    }
    return { label: 'Ожидает', className: 'bg-telegram-secondary-bg text-telegram-hint border border-border' }
}

export interface WorkoutExerciseCardProps {
    exercise: CompletedExercise
    exerciseIndex: number
    currentExerciseIndex: number
    currentSetIndex: number
    onOpen: () => void
    onToggleSet?: (setNumber: number) => void
    /** Раскрыть карточку (для текущего упражнения) */
    defaultExpanded?: boolean
}

export const WorkoutExerciseCard = memo(function WorkoutExerciseCard({
    exercise,
    exerciseIndex,
    currentExerciseIndex,
    currentSetIndex,
    onOpen,
    onToggleSet,
    defaultExpanded,
}: WorkoutExerciseCardProps) {
    const meta = getExerciseSummaryMeta(exercise)
    const session = deriveExerciseSessionState(exercise, exerciseIndex, currentExerciseIndex, currentSetIndex)
    const badge = statusBadge(session.status)
    const metaLine = buildMetaLine(exercise)
    const completedSets = exercise.sets_completed.filter((set) => set.completed).length
    const progressPercent = exercise.sets_completed.length > 0
        ? Math.round((completedSets / exercise.sets_completed.length) * 100)
        : 0
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? session.status === 'current')

    const handleToggleExpand = () => {
        setIsExpanded((v) => !v)
    }

    const handleSetClick = (setNumber: number, e: React.MouseEvent) => {
        e.stopPropagation()
        onToggleSet?.(setNumber)
    }

    return (
        <div
            className={cn(
                'overflow-hidden rounded-2xl border shadow-sm transition-all touch-manipulation',
                'min-h-[72px]', // Large touch target
                session.status === 'current'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                    : 'border-border bg-telegram-secondary-bg',
                session.status === 'done' && 'opacity-75',
            )}
        >
            {/* Header — clickable */}
            <button
                type="button"
                onClick={onOpen}
                className="w-full p-4 text-left active:scale-[0.99]"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold leading-snug text-telegram-text">{exercise.name}</p>
                        <p className="mt-1 text-xs text-telegram-hint">
                            {meta.label} · {metaLine}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', badge.className)}>
                            {badge.label}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleToggleExpand()
                            }}
                            className="rounded-full p-1.5 text-telegram-hint transition-colors hover:bg-telegram-bg"
                            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-telegram-hint">
                    <span>{completedSets}/{exercise.sets_completed.length} подходов</span>
                    <span>{progressPercent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-telegram-bg">
                    <div
                        className={cn(
                            'h-full rounded-full transition-[width] duration-300',
                            session.status === 'done' ? 'bg-emerald-500' : 'bg-primary',
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                </div>
            </button>

            {/* Set dots (collapsed) */}
            {!isExpanded && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                    {exercise.sets_completed.map((set, setIndex) => (
                        <span
                            key={set.set_number}
                            className={cn(
                                'h-2 w-2 rounded-full',
                                setDotClass(exerciseIndex, setIndex, currentExerciseIndex, currentSetIndex, set.completed),
                            )}
                            aria-hidden
                        />
                    ))}
                </div>
            )}

            {/* Set buttons (expanded — large touch targets) */}
            {isExpanded && (
                <div className="grid grid-cols-3 gap-2 p-4 pt-0">
                    {exercise.sets_completed.map((set, setIndex) => {
                        const isCurrent = exerciseIndex === currentExerciseIndex && setIndex === currentSetIndex
                        const isCompleted = set.completed
                        return (
                            <button
                                key={set.set_number}
                                type="button"
                                onClick={(e) => handleSetClick(set.set_number, e)}
                                className={cn(
                                    'flex min-h-[56px] flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all',
                                    'active:scale-[0.98]',
                                    isCompleted && 'bg-emerald-500 text-white shadow-success',
                                    isCurrent && !isCompleted && 'bg-primary text-white shadow-primary',
                                    !isCurrent && !isCompleted && 'border border-border bg-telegram-bg text-telegram-text',
                                )}
                            >
                                <span className="text-xs opacity-80">{set.set_number}</span>
                                {isCompleted ? (
                                    <Check className="h-5 w-5" />
                                ) : (
                                    <span className="text-lg">
                                        {set.weight != null ? `${set.weight}` : '—'}
                                        {set.reps != null ? `×${set.reps}` : ''}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
})

WorkoutExerciseCard.displayName = 'WorkoutExerciseCard'
