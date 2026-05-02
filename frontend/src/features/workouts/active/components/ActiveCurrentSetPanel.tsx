import { memo, useCallback, useMemo } from 'react'
import { BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Plus, SkipForward } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { cn } from '@shared/lib/cn'
import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import { WeightRecommendationChip } from './WeightRecommendationChip'

const RPE_OPTIONS = [6, 7, 8, 9, 10]
const QUICK_WEIGHT_DELTAS = [-2.5, 2.5]

function formatRest(seconds: number): string {
    if (seconds < 60) return `${seconds}с`
    if (seconds % 60 === 0) return `${seconds / 60} мин`
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function getSetVolume(set: CompletedSet | null): number | null {
    if (!set || typeof set.weight !== 'number' || typeof set.reps !== 'number') return null
    return Math.round(set.weight * set.reps * 10) / 10
}

export interface ActiveCurrentSetPanelProps {
    exercise: CompletedExercise | null
    set: CompletedSet | null
    exerciseIndex: number
    setIndex: number
    exerciseCount: number
    completedSetCount: number
    totalSetCount: number
    elapsedLabel: string
    restDefaultSeconds: number
    hasPrevExercise: boolean
    hasNextExercise: boolean
    weightRecommendation?: { suggested_weight?: number; message?: string }
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    onCompleteSet: () => void
    onSkipSet: () => void
    onAddSet: () => void
    onStartRest: () => void
    onGoToPreviousExercise: () => void
    onGoToNextExercise: () => void
}

export const ActiveCurrentSetPanel = memo(function ActiveCurrentSetPanel({
    exercise,
    set,
    exerciseIndex,
    setIndex,
    exerciseCount,
    completedSetCount,
    totalSetCount,
    elapsedLabel,
    restDefaultSeconds,
    hasPrevExercise,
    hasNextExercise,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    onUpdateSet,
    onCompleteSet,
    onSkipSet,
    onAddSet,
    onStartRest,
    onGoToPreviousExercise,
    onGoToNextExercise,
}: ActiveCurrentSetPanelProps) {
    const progressPercent = totalSetCount > 0 ? Math.round((completedSetCount / totalSetCount) * 100) : 0
    const volume = useMemo(() => getSetVolume(set), [set])

    const updateCurrentSet = useCallback(
        (patch: Partial<CompletedSet>) => {
            if (!exercise || !set) return
            onUpdateSet(exerciseIndex, set.set_number, patch)
        },
        [exercise, exerciseIndex, onUpdateSet, set],
    )

    if (!exercise || !set) {
        return (
            <section className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg p-4">
                <p className="text-sm text-telegram-hint">Нет активного подхода</p>
            </section>
        )
    }

    return (
        <section className="rounded-2xl border border-primary/25 bg-telegram-secondary-bg p-4 shadow-sm" data-testid="active-current-set-panel">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Упражнение {exerciseIndex + 1}/{exerciseCount}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-tight text-telegram-text">
                        {exercise.name}
                    </h2>
                    <p className="mt-1 text-sm text-telegram-hint">
                        Подход {setIndex + 1}/{exercise.sets_completed.length}
                    </p>
                </div>
                <div className="shrink-0 rounded-xl bg-telegram-bg px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-telegram-hint">Прошло</p>
                    <p className="text-lg font-bold tabular-nums text-telegram-text">{elapsedLabel}</p>
                </div>
            </div>

            <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-telegram-hint">Прогресс</span>
                    <span className="font-semibold text-telegram-text">
                        {completedSetCount}/{totalSetCount}
                    </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-telegram-bg">
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                </div>
            </div>

            <WeightRecommendationChip
                compact
                suggestedWeight={weightRecommendation?.suggested_weight}
                message={weightRecommendation?.message}
                isLoading={isWeightRecLoading}
                isError={isWeightRecError}
                onApply={
                    weightRecommendation?.suggested_weight != null
                        ? () => updateCurrentSet({ weight: weightRecommendation.suggested_weight })
                        : undefined
                }
                className="mt-4"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block rounded-xl border border-border bg-telegram-bg p-3">
                    <span className="text-xs font-medium text-telegram-hint">Повторы</span>
                    <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={set.reps ?? ''}
                        onChange={(event) => updateCurrentSet({ reps: parseOptionalNumber(event.target.value) })}
                        className="mt-1 w-full bg-transparent text-3xl font-bold tabular-nums text-telegram-text outline-none"
                    />
                </label>
                <label className="block rounded-xl border border-border bg-telegram-bg p-3">
                    <span className="text-xs font-medium text-telegram-hint">Вес, кг</span>
                    <input
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        value={set.weight ?? ''}
                        onChange={(event) => updateCurrentSet({ weight: parseOptionalNumber(event.target.value) })}
                        className="mt-1 w-full bg-transparent text-3xl font-bold tabular-nums text-telegram-text outline-none"
                    />
                </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
                {QUICK_WEIGHT_DELTAS.map((delta) => (
                    <button
                        key={delta}
                        type="button"
                        onClick={() => updateCurrentSet({ weight: Math.max(0, Number(((set.weight ?? 0) + delta).toFixed(2))) })}
                        className="min-h-11 flex-1 rounded-xl bg-telegram-bg px-3 py-2 text-sm font-semibold text-telegram-text active:bg-telegram-secondary-bg"
                    >
                        {delta > 0 ? '+' : ''}
                        {delta} кг
                    </button>
                ))}
                <button
                    type="button"
                    onClick={onStartRest}
                    className="min-h-11 flex-1 rounded-xl bg-telegram-bg px-3 py-2 text-sm font-semibold text-primary active:bg-telegram-secondary-bg"
                >
                    <Clock3 className="mr-1 inline h-4 w-4" />
                    {formatRest(restDefaultSeconds)}
                </button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-telegram-bg/70 p-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-telegram-hint">RPE</span>
                    {volume != null ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-telegram-text">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                            {volume} кг
                        </span>
                    ) : null}
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                    {RPE_OPTIONS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => updateCurrentSet({ rpe: set.rpe === value ? undefined : value })}
                            className={cn(
                                'min-h-11 rounded-xl text-sm font-bold transition-colors',
                                set.rpe === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-telegram-secondary-bg text-telegram-hint active:bg-telegram-bg',
                            )}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
                <Button type="button" variant="secondary" className="min-h-[52px] border-border" onClick={onSkipSet}>
                    <SkipForward className="mr-1 h-4 w-4" />
                    Пропуск
                </Button>
                <Button type="button" className="min-h-[52px]" onClick={onCompleteSet}>
                    <Check className="mr-1 h-5 w-5" />
                    Готово
                </Button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                    type="button"
                    disabled={!hasPrevExercise}
                    onClick={onGoToPreviousExercise}
                    className="flex min-h-11 items-center justify-center rounded-xl bg-telegram-bg px-2 text-xs font-semibold text-telegram-hint disabled:opacity-40"
                    aria-label="Предыдущее упражнение"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onAddSet}
                    className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-primary/10 px-2 text-xs font-semibold text-primary"
                >
                    <Plus className="h-4 w-4" />
                    Add Set
                </button>
                <button
                    type="button"
                    disabled={!hasNextExercise}
                    onClick={onGoToNextExercise}
                    className="flex min-h-11 items-center justify-center rounded-xl bg-telegram-bg px-2 text-xs font-semibold text-telegram-hint disabled:opacity-40"
                    aria-label="Следующее упражнение"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </section>
    )
})

ActiveCurrentSetPanel.displayName = 'ActiveCurrentSetPanel'
