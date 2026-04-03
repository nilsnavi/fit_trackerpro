import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedSet } from '@features/workouts/types/workouts'

const RPE_OPTIONS = [6, 7, 8, 9, 10]
const RIR_OPTIONS = [0, 1, 2, 3, 4]

interface ExerciseSetRowProps {
    set: CompletedSet
    exerciseIndex: number
    onFocusSet: (exerciseIndex: number, setIndex: number) => void
    onToggleCompleted: (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => void
    onCopyPrevious: (exerciseIndex: number, setNumber: number) => void
    onAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
}

export function ExerciseSetRow({
    set,
    exerciseIndex,
    onFocusSet,
    onToggleCompleted,
    onCopyPrevious,
    onAdjustWeight,
    onUpdateSet,
}: ExerciseSetRowProps) {
    return (
        <div className="rounded-lg bg-telegram-bg/60 p-2 text-sm text-telegram-text">
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Подход {set.set_number}</span>
                <button
                    type="button"
                    onClick={() => {
                        onFocusSet(exerciseIndex, set.set_number - 1)
                        onToggleCompleted(exerciseIndex, set.set_number, !set.completed)
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs transition-colors ${set.completed
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                        }`}
                >
                    {set.completed ? 'Выполнен' : 'Отметить'}
                </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                    type="button"
                    onClick={() => onCopyPrevious(exerciseIndex, set.set_number)}
                    className="rounded-md bg-telegram-bg px-2 py-1 text-[11px] text-telegram-hint"
                >
                    Копировать с прошлого
                </button>
                {[1.25, 2.5, 5].map((delta) => (
                    <button
                        key={delta}
                        type="button"
                        onClick={() => onAdjustWeight(exerciseIndex, set.set_number, delta)}
                        className="rounded-md bg-telegram-bg px-2 py-1 text-[11px] text-telegram-hint"
                    >
                        +{delta}
                    </button>
                ))}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <label className="text-xs text-telegram-hint">
                    Повторы
                    <input
                        type="number"
                        min={0}
                        value={set.reps ?? ''}
                        onFocus={() => onFocusSet(exerciseIndex, set.set_number - 1)}
                        onChange={(e) =>
                            onUpdateSet(exerciseIndex, set.set_number, {
                                reps: parseOptionalNumber(e.target.value),
                            })
                        }
                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                    />
                </label>
                <label className="text-xs text-telegram-hint">
                    Вес (кг)
                    <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={set.weight ?? ''}
                        onFocus={() => onFocusSet(exerciseIndex, set.set_number - 1)}
                        onChange={(e) =>
                            onUpdateSet(exerciseIndex, set.set_number, {
                                weight: parseOptionalNumber(e.target.value),
                            })
                        }
                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                    />
                </label>
                <label className="text-xs text-telegram-hint">
                    Длительность (сек)
                    <input
                        type="number"
                        min={0}
                        value={set.duration ?? ''}
                        onFocus={() => onFocusSet(exerciseIndex, set.set_number - 1)}
                        onChange={(e) =>
                            onUpdateSet(exerciseIndex, set.set_number, {
                                duration: parseOptionalNumber(e.target.value),
                            })
                        }
                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                    />
                </label>
                <label className="text-xs text-telegram-hint">
                    Дистанция (км)
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={set.distance ?? ''}
                        onFocus={() => onFocusSet(exerciseIndex, set.set_number - 1)}
                        onChange={(e) =>
                            onUpdateSet(exerciseIndex, set.set_number, {
                                distance: parseOptionalNumber(e.target.value),
                            })
                        }
                        className="mt-0.5 w-full rounded-md border border-border bg-telegram-bg px-2 py-1 text-sm text-telegram-text"
                    />
                </label>
            </div>

            <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-telegram-hint">RPE</span>
                    {RPE_OPTIONS.map((value) => (
                        <button
                            key={`rpe-${value}`}
                            type="button"
                            onClick={() => {
                                onFocusSet(exerciseIndex, set.set_number - 1)
                                onUpdateSet(exerciseIndex, set.set_number, {
                                    rpe: set.rpe === value ? undefined : value,
                                })
                            }}
                            className={`rounded-full px-2 py-1 text-[11px] transition-colors ${set.rpe === value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-telegram-bg text-telegram-hint'
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
                            onClick={() => {
                                onFocusSet(exerciseIndex, set.set_number - 1)
                                onUpdateSet(exerciseIndex, set.set_number, {
                                    rir: set.rir === value ? undefined : value,
                                })
                            }}
                            className={`rounded-full px-2 py-1 text-[11px] transition-colors ${set.rir === value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-telegram-bg text-telegram-hint'
                                }`}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
