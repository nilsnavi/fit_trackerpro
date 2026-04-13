import { memo } from 'react'
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
}

export const WorkoutExerciseCard = memo(function WorkoutExerciseCard({
    exercise,
    exerciseIndex,
    currentExerciseIndex,
    currentSetIndex,
    onOpen,
}: WorkoutExerciseCardProps) {
    const meta = getExerciseSummaryMeta(exercise)
    const session = deriveExerciseSessionState(exercise, exerciseIndex, currentExerciseIndex, currentSetIndex)
    const badge = statusBadge(session.status)
    const metaLine = buildMetaLine(exercise)

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'w-full rounded-2xl border p-4 text-left transition-opacity touch-manipulation',
                'active:scale-[0.99]',
                session.status === 'current'
                    ? 'border-primary border-l-4 bg-telegram-secondary-bg'
                    : 'border-border bg-telegram-secondary-bg',
                session.status === 'done' && 'opacity-70',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-telegram-text">{exercise.name}</p>
                    <p className="mt-1 text-xs text-telegram-hint">
                        {meta.label} · {metaLine}
                    </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', badge.className)}>
                    {badge.label}
                </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
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
        </button>
    )
})

WorkoutExerciseCard.displayName = 'WorkoutExerciseCard'
