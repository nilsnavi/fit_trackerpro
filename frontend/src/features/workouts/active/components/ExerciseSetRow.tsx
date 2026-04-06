import { memo, useCallback, useEffect, useState } from 'react'
import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedSet } from '@features/workouts/types/workouts'

const RPE_OPTIONS = [6, 7, 8, 9, 10]
const RIR_OPTIONS = [0, 1, 2, 3, 4]
const WEIGHT_DELTAS = [1.25, 2.5, 5]

interface ExerciseSetRowProps {
    set: CompletedSet
    exerciseIndex: number
    isCurrent: boolean
    previousBestLabel: string
    onFocusSet: (exerciseIndex: number, setIndex: number) => void
    onToggleCompleted: (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => void
    onSkipSet: () => void
    onCopyPrevious: (exerciseIndex: number, setNumber: number) => void
    onAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
}

export const ExerciseSetRow = memo(function ExerciseSetRow({
    set,
    exerciseIndex,
    isCurrent,
    previousBestLabel,
    onFocusSet,
    onToggleCompleted,
    onSkipSet,
    onCopyPrevious,
    onAdjustWeight,
    onUpdateSet,
}: ExerciseSetRowProps) {
    const setIndex = set.set_number - 1
    const [showEffort, setShowEffort] = useState(Boolean(set.rpe != null || set.rir != null))

    useEffect(() => {
        if (set.rpe != null || set.rir != null) {
            setShowEffort(true)
        }
    }, [set.rir, set.rpe])

    // Memoized callbacks to prevent unnecessary child re-renders
    const handleToggleCompleted = useCallback(() => {
        onFocusSet(exerciseIndex, setIndex)
        onToggleCompleted(exerciseIndex, set.set_number, !set.completed)
    }, [exerciseIndex, setIndex, set.set_number, set.completed, onFocusSet, onToggleCompleted])

    const handleCopyPrevious = useCallback(() => {
        onCopyPrevious(exerciseIndex, set.set_number)
    }, [exerciseIndex, set.set_number, onCopyPrevious])

    const handleSkipSet = useCallback(() => {
        onFocusSet(exerciseIndex, setIndex)
        onSkipSet()
    }, [exerciseIndex, onFocusSet, onSkipSet, setIndex])

    const handleAdjustWeight = useCallback(
        (delta: number) => {
            onAdjustWeight(exerciseIndex, set.set_number, delta)
        },
        [exerciseIndex, set.set_number, onAdjustWeight]
    )

    const handleRepsChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onUpdateSet(exerciseIndex, set.set_number, {
                reps: parseOptionalNumber(e.target.value),
            })
        },
        [exerciseIndex, set.set_number, onUpdateSet]
    )

    const handleWeightChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onUpdateSet(exerciseIndex, set.set_number, {
                weight: parseOptionalNumber(e.target.value),
            })
        },
        [exerciseIndex, set.set_number, onUpdateSet]
    )

    const handleDurationChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onUpdateSet(exerciseIndex, set.set_number, {
                duration: parseOptionalNumber(e.target.value),
            })
        },
        [exerciseIndex, set.set_number, onUpdateSet]
    )

    const handleDistanceChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onUpdateSet(exerciseIndex, set.set_number, {
                distance: parseOptionalNumber(e.target.value),
            })
        },
        [exerciseIndex, set.set_number, onUpdateSet]
    )

    const handleOnFocusSet = useCallback(() => {
        onFocusSet(exerciseIndex, setIndex)
    }, [exerciseIndex, setIndex, onFocusSet])

    const handleRpeToggle = useCallback(
        (value: number) => {
            onFocusSet(exerciseIndex, setIndex)
            onUpdateSet(exerciseIndex, set.set_number, {
                rpe: set.rpe === value ? undefined : value,
            })
        },
        [exerciseIndex, setIndex, set.set_number, set.rpe, onFocusSet, onUpdateSet]
    )

    const handleRirToggle = useCallback(
        (value: number) => {
            onFocusSet(exerciseIndex, setIndex)
            onUpdateSet(exerciseIndex, set.set_number, {
                rir: set.rir === value ? undefined : value,
            })
        },
        [exerciseIndex, setIndex, set.set_number, set.rir, onFocusSet, onUpdateSet]
    )

    return (
        <div
            className={`rounded-lg bg-telegram-bg/60 p-2 text-sm text-telegram-text ${isCurrent ? 'border border-primary/35 bg-primary/5' : 'border border-transparent'}`}
        >
            <div className="flex items-center justify-between gap-2">
                <div>
                    <span className="font-medium">Подход {set.set_number}</span>
                    {isCurrent && <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-primary">Текущий</span>}
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={handleSkipSet}
                        className="min-h-[40px] touch-manipulation rounded-xl bg-telegram-secondary-bg px-3 py-2 text-xs font-medium text-telegram-hint"
                    >
                        Пропуск
                    </button>
                    <button
                        type="button"
                        data-testid="set-toggle-btn"
                        onClick={handleToggleCompleted}
                        className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${set.completed
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-primary text-primary-foreground'
                            }`}
                    >
                        {set.completed ? '✓ Готово' : 'Готово'}
                    </button>
                </div>
            </div>

            <p className="mt-1 text-[11px] text-telegram-hint">Предыдущий лучший: {previousBestLabel}</p>

            <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                    type="button"
                    onClick={handleCopyPrevious}
                    className="min-h-[36px] touch-manipulation rounded-lg bg-telegram-bg px-3 py-2 text-xs text-telegram-hint active:bg-telegram-secondary-bg"
                >
                    Скопировать
                </button>
                {WEIGHT_DELTAS.map((delta) => (
                    <button
                        key={delta}
                        type="button"
                        onClick={() => handleAdjustWeight(delta)}
                        className="min-h-[36px] touch-manipulation rounded-lg bg-telegram-bg px-3 py-2 text-xs text-telegram-hint active:bg-telegram-secondary-bg"
                    >
                        +{delta}
                    </button>
                ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="text-xs text-telegram-hint">
                    Повторы
                    <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        enterKeyHint="next"
                        value={set.reps ?? ''}
                        onFocus={handleOnFocusSet}
                        onChange={handleRepsChange}
                        className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                    />
                </label>
                <label className="text-xs text-telegram-hint">
                    Вес (кг)
                    <input
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        enterKeyHint="next"
                        value={set.weight ?? ''}
                        onFocus={handleOnFocusSet}
                        onChange={handleWeightChange}
                        className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                    />
                </label>
                <label className="text-xs text-telegram-hint">
                    Длительность (сек)
                    <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        enterKeyHint="next"
                        value={set.duration ?? ''}
                        onFocus={handleOnFocusSet}
                        onChange={handleDurationChange}
                        className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                    />
                </label>
                <label className="text-xs text-telegram-hint">
                    Дистанция (км)
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        enterKeyHint="done"
                        value={set.distance ?? ''}
                        onFocus={handleOnFocusSet}
                        onChange={handleDistanceChange}
                        className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                    />
                </label>
            </div>

            <div className="mt-2 space-y-2">
                <button
                    type="button"
                    onClick={() => setShowEffort((prev) => !prev)}
                    className="min-h-[32px] rounded-lg bg-telegram-bg px-2.5 py-1.5 text-[11px] font-medium text-telegram-hint"
                >
                    {showEffort ? 'Скрыть RPE/RIR' : 'Добавить RPE (опционально)'}
                </button>

                {showEffort && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-telegram-hint">RPE</span>
                            {RPE_OPTIONS.map((value) => (
                                <button
                                    key={`rpe-${value}`}
                                    type="button"
                                    onClick={() => handleRpeToggle(value)}
                                    className={`min-h-[36px] min-w-[36px] touch-manipulation rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${set.rpe === value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'
                                        }`}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-telegram-hint">RIR</span>
                            {RIR_OPTIONS.map((value) => (
                                <button
                                    key={`rir-${value}`}
                                    type="button"
                                    onClick={() => handleRirToggle(value)}
                                    className={`min-h-[36px] min-w-[36px] touch-manipulation rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${set.rir === value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'
                                        }`}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
})

ExerciseSetRow.displayName = 'ExerciseSetRow'
