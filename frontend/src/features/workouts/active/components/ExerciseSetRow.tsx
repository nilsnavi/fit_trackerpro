import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedSet } from '@features/workouts/types/workouts'

const RPE_OPTIONS = [6, 7, 8, 9, 10]
const RIR_OPTIONS = [0, 1, 2, 3, 4]

// Quick increment step options
const WEIGHT_STEP_OPTIONS = [0.5, 1, 2.5, 5]

function toMinutes(durationSeconds?: number): number {
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return 0
    }
    return Math.max(0, Math.round(durationSeconds / 60))
}

function toSeconds(durationMinutes: number): number | undefined {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return undefined
    return Math.round(durationMinutes * 60)
}

function formatSetValues(set: CompletedSet): string {
    const parts = [
        typeof set.weight === 'number' ? `${set.weight} кг` : null,
        typeof set.reps === 'number' ? `${set.reps} повт` : null,
        typeof set.duration === 'number' ? `${set.duration} сек` : null,
        typeof set.distance === 'number' ? `${set.distance} км` : null,
    ].filter((part): part is string => Boolean(part))

    return parts.length > 0 ? parts.join(' • ') : 'Без значений'
}

interface ExerciseSetRowProps {
    set: CompletedSet
    exerciseIndex: number
    isCurrent: boolean
    previousBestLabel: string
    previousSetValues?: Partial<CompletedSet>
    onFocusSet: (exerciseIndex: number, setIndex: number) => void
    onToggleCompleted: (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => void
    onSkipSet: () => void
    onCopyPrevious: (exerciseIndex: number, setNumber: number) => void
    onAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    weightDeltas: number[]
    weightRecommendation?: { suggested_weight?: number; message?: string }
    isWeightRecLoading?: boolean
    isWeightRecError?: boolean
}

export const ExerciseSetRow = memo(function ExerciseSetRow({
    set,
    exerciseIndex,
    isCurrent,
    previousBestLabel,
    previousSetValues,
    onFocusSet,
    onToggleCompleted,
    onSkipSet,
    onCopyPrevious,
    onAdjustWeight,
    onUpdateSet,
    weightDeltas,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
}: ExerciseSetRowProps) {
    const setIndex = set.set_number - 1
    const [showEffort, setShowEffort] = useState(Boolean(set.rpe != null || set.rir != null))
    const [isExpanded, setIsExpanded] = useState(isCurrent)
    const [weightStep, setWeightStep] = useState(1)
    const repsInputRef = useRef<HTMLInputElement | null>(null)
    const weightInputRef = useRef<HTMLInputElement | null>(null)
    const durationInputRef = useRef<HTMLInputElement | null>(null)
    const distanceInputRef = useRef<HTMLInputElement | null>(null)
    const didAutoFocusRef = useRef(false)
    const cardioPlanRef = useRef({
        durationMinutes: toMinutes(set.duration),
        pace: typeof set.distance === 'number' && Number.isFinite(set.distance) ? set.distance : 0,
    })

    const isCardioSet =
        typeof set.duration === 'number' &&
        set.duration > 0 &&
        set.weight == null &&
        set.reps == null

    useEffect(() => {
        if (set.rpe != null || set.rir != null) {
            setShowEffort(true)
        }
    }, [set.rir, set.rpe])

    useEffect(() => {
        if (isCurrent) {
            setIsExpanded(true)
        }
    }, [isCurrent])

    useEffect(() => {
        if (!isCurrent) {
            didAutoFocusRef.current = false
            return
        }
        if (didAutoFocusRef.current) return

        const target =
            set.reps == null
                ? repsInputRef.current
                : set.weight == null
                    ? weightInputRef.current
                    : set.duration == null
                        ? durationInputRef.current
                        : distanceInputRef.current

        if (!target) return

        didAutoFocusRef.current = true
        requestAnimationFrame(() => {
            target.focus()
            target.select()
        })
    }, [isCurrent, set.distance, set.duration, set.reps, set.weight])

    const focusNext = useCallback((field: 'reps' | 'weight' | 'duration' | 'distance') => {
        if (field === 'reps') {
            weightInputRef.current?.focus()
            weightInputRef.current?.select()
            return
        }
        if (field === 'weight') {
            durationInputRef.current?.focus()
            durationInputRef.current?.select()
            return
        }
        if (field === 'duration') {
            distanceInputRef.current?.focus()
            distanceInputRef.current?.select()
            return
        }
        distanceInputRef.current?.blur()
    }, [])

    const handleNumericEnter = useCallback((event: React.KeyboardEvent<HTMLInputElement>, field: 'reps' | 'weight' | 'duration' | 'distance') => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        focusNext(field)
    }, [focusNext])

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

    const handleCardioDurationStep = useCallback(
        (deltaMinutes: number) => {
            const currentMinutes = toMinutes(set.duration)
            const nextMinutes = Math.max(0, currentMinutes + deltaMinutes)
            onUpdateSet(exerciseIndex, set.set_number, {
                duration: toSeconds(nextMinutes),
            })
        },
        [exerciseIndex, onUpdateSet, set.duration, set.set_number],
    )

    const handleCardioPaceStep = useCallback(
        (delta: number) => {
            const currentPace = typeof set.distance === 'number' && Number.isFinite(set.distance) ? set.distance : 0
            const nextPace = Math.max(0, currentPace + delta)
            onUpdateSet(exerciseIndex, set.set_number, {
                distance: nextPace > 0 ? nextPace : undefined,
            })
        },
        [exerciseIndex, onUpdateSet, set.distance, set.set_number],
    )

    const handleOnFocusSet = useCallback(() => {
        onFocusSet(exerciseIndex, setIndex)
        setIsExpanded(true)
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

    const isCollapsed = !isCurrent && !isExpanded

    // Format previous set values for hint display
    const previousSetHint = useMemo(() => {
        if (!previousSetValues) return null
        const parts: string[] = []
        if (previousSetValues.weight != null) parts.push(`${previousSetValues.weight} кг`)
        if (previousSetValues.reps != null) parts.push(`${previousSetValues.reps} повт`)
        return parts.length > 0 ? parts.join(' x ') : null
    }, [previousSetValues])

    return (
        <div
            data-testid="set-row"
            data-set-number={set.set_number}
            data-current={isCurrent ? 'true' : 'false'}
            className={`rounded-lg bg-telegram-bg/60 p-2 text-sm text-telegram-text ${isCurrent ? 'scroll-mt-24 scroll-mb-52 border border-primary/35 bg-primary/5' : 'border border-transparent'}`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <span className="font-medium">Подход {set.set_number}</span>
                    {isCurrent && <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-primary">Текущий</span>}
                    {isCollapsed ? (
                        <p className="mt-1 truncate text-[11px] text-telegram-hint">{formatSetValues(set)}</p>
                    ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                    {!isCurrent ? (
                        <button
                            type="button"
                            data-testid="set-row-expand-btn"
                            onClick={() => setIsExpanded((prev) => !prev)}
                            className="flex min-h-11 touch-manipulation items-center gap-1 rounded-xl bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint"
                        >
                            {isExpanded ? 'Свернуть' : 'Показать'}
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        data-testid="set-skip-btn"
                        onClick={handleSkipSet}
                        className="min-h-11 touch-manipulation rounded-xl bg-telegram-secondary-bg px-3 py-2 text-xs font-medium text-telegram-hint"
                    >
                        Пропуск
                    </button>
                    <button
                        type="button"
                        data-testid="set-toggle-btn"
                        onClick={handleToggleCompleted}
                        className={`min-h-11 min-w-[5.5rem] touch-manipulation rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${set.completed
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-primary text-primary-foreground'
                            }`}
                    >
                        {set.completed ? '✓ Готово' : 'Готово'}
                    </button>
                </div>
            </div>

            {!isCollapsed ? (
                <>
                    {/* Блок рекомендации веса */}
                    {isCurrent && weightRecommendation && (weightRecommendation.suggested_weight || weightRecommendation.message) && (
                        <div className="mt-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
                            <span className="block text-xs font-semibold text-primary mb-1">Рекомендация веса</span>
                            {isWeightRecLoading ? (
                                <span className="text-xs text-telegram-hint">Загрузка рекомендации...</span>
                            ) : isWeightRecError ? (
                                <span className="text-xs text-danger">Ошибка загрузки рекомендации</span>
                            ) : (
                                <>
                                    {weightRecommendation.suggested_weight != null && (
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <span className="text-base font-bold text-primary">{weightRecommendation.suggested_weight} кг</span>
                                            <button
                                                type="button"
                                                data-testid="set-apply-suggested-weight-btn"
                                                onClick={() => {
                                                    onFocusSet(exerciseIndex, setIndex)
                                                    onUpdateSet(exerciseIndex, set.set_number, {
                                                        weight: weightRecommendation.suggested_weight,
                                                    })
                                                }}
                                                className="min-h-10 touch-manipulation rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground active:opacity-90"
                                            >
                                                Подставить
                                            </button>
                                        </div>
                                    )}
                                    {weightRecommendation.message && (
                                        <span className="block text-xs text-telegram-hint mt-1">{weightRecommendation.message}</span>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    <p className="mt-1 text-[11px] text-telegram-hint">Предыдущий лучший: {previousBestLabel}</p>
                    {previousSetHint && isCurrent && (
                        <button
                            type="button"
                            data-testid="set-copy-previous-hint-btn"
                            onClick={handleCopyPrevious}
                            className="mt-1 w-full rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-left text-xs font-semibold text-primary touch-manipulation active:bg-primary/15"
                        >
                            Прошлый подход: {previousSetHint}
                            <span className="mt-0.5 block text-[10px] font-normal text-telegram-hint">Тап — скопировать в текущий</span>
                        </button>
                    )}

                    {/* Consolidated Weight Adjustment Bar */}
                    {!isCardioSet && isCurrent && (
                        <div className="mt-2 space-y-1.5">
                            {/* Step selector */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                <span className="shrink-0 text-[11px] text-telegram-hint">Шаг:</span>
                                {WEIGHT_STEP_OPTIONS.map((step) => (
                                    <button
                                        key={`step-${step}`}
                                        type="button"
                                        data-testid="set-weight-step-btn"
                                        data-step={step}
                                        onClick={() => setWeightStep(step)}
                                        className={`min-h-10 min-w-10 shrink-0 touch-manipulation rounded-full px-2.5 text-xs font-semibold ${weightStep === step
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'
                                            }`}
                                    >
                                        {step}
                                    </button>
                                ))}
                            </div>
                            {/* Weight adjustment buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    data-testid="set-copy-previous-btn"
                                    onClick={handleCopyPrevious}
                                    className="flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint active:bg-telegram-secondary-bg"
                                >
                                    Как прошлый
                                </button>
                                <button
                                    type="button"
                                    data-testid="set-weight-dec-btn"
                                    data-step={weightStep}
                                    onClick={() => handleAdjustWeight(-weightStep)}
                                    className="flex min-h-[44px] w-[52px] touch-manipulation items-center justify-center rounded-lg bg-telegram-bg text-sm font-bold text-telegram-text active:bg-telegram-secondary-bg"
                                    aria-label={`Уменьшить на ${weightStep}`}
                                >
                                    <Minus className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    data-testid="set-weight-inc-btn"
                                    data-step={weightStep}
                                    onClick={() => handleAdjustWeight(weightStep)}
                                    className="flex min-h-[44px] w-[52px] touch-manipulation items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary active:bg-primary/20"
                                    aria-label={`Увеличить на ${weightStep}`}
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Legacy weight buttons for non-current sets */}
                    {!isCardioSet && !isCurrent && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={handleCopyPrevious}
                                className="min-h-[40px] touch-manipulation rounded-lg bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint active:bg-telegram-secondary-bg"
                            >
                                Как прошлый
                            </button>
                            {weightDeltas.map((delta) => (
                                <button
                                    key={`minus-${delta}`}
                                    type="button"
                                    onClick={() => handleAdjustWeight(-delta)}
                                    className="min-h-[40px] touch-manipulation rounded-lg bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint active:bg-telegram-secondary-bg"
                                >
                                    -{delta}
                                </button>
                            ))}
                            {weightDeltas.map((delta) => (
                                <button
                                    key={delta}
                                    type="button"
                                    onClick={() => handleAdjustWeight(delta)}
                                    className="min-h-[40px] touch-manipulation rounded-lg bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint active:bg-telegram-secondary-bg"
                                >
                                    +{delta}
                                </button>
                            ))}
                        </div>
                    )}

                    {isCardioSet ? (
                        <div className="mt-2 rounded-xl border border-border bg-telegram-secondary-bg p-3">
                            <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-sm text-telegram-text items-center">
                                <span className="text-telegram-hint">План</span>
                                <span className="font-semibold">{cardioPlanRef.current.durationMinutes} мин</span>
                                <span className="font-semibold">{cardioPlanRef.current.pace} темп</span>

                                <span className="text-telegram-hint">Факт</span>
                                <div className="flex items-center justify-between rounded-lg bg-telegram-bg px-2 py-1">
                                    <button
                                        type="button"
                                        onClick={() => handleCardioDurationStep(-1)}
                                        className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-telegram-hint active:bg-telegram-secondary-bg"
                                        aria-label="Уменьшить время"
                                    >
                                        −
                                    </button>
                                    <span className="font-semibold">{toMinutes(set.duration)}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleCardioDurationStep(1)}
                                        className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-telegram-hint active:bg-telegram-secondary-bg"
                                        aria-label="Увеличить время"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-telegram-bg px-2 py-1">
                                    <button
                                        type="button"
                                        onClick={() => handleCardioPaceStep(-1)}
                                        className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-telegram-hint active:bg-telegram-secondary-bg"
                                        aria-label="Уменьшить темп"
                                    >
                                        −
                                    </button>
                                    <span className="font-semibold">{typeof set.distance === 'number' ? set.distance : 0}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleCardioPaceStep(1)}
                                        className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-telegram-hint active:bg-telegram-secondary-bg"
                                        aria-label="Увеличить темп"
                                    >
                                        +
                                    </button>
                                </div>

                                <span className="text-telegram-hint">Прошлый</span>
                                <span className="text-telegram-hint">{cardioPlanRef.current.durationMinutes} мин</span>
                                <span className="text-telegram-hint">{cardioPlanRef.current.pace} темп</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <label className="text-xs text-telegram-hint">
                                Повторы
                                <input
                                    ref={repsInputRef}
                                    type="number"
                                    min={0}
                                    inputMode="numeric"
                                    enterKeyHint="next"
                                    value={set.reps ?? ''}
                                    onFocus={handleOnFocusSet}
                                    onChange={handleRepsChange}
                                    onKeyDown={(event) => handleNumericEnter(event, 'reps')}
                                    className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                                />
                            </label>
                            <label className="text-xs text-telegram-hint">
                                Вес (кг)
                                <input
                                    ref={weightInputRef}
                                    data-testid="set-weight-input"
                                    type="number"
                                    min={0}
                                    step="0.5"
                                    inputMode="decimal"
                                    enterKeyHint="next"
                                    value={set.weight ?? ''}
                                    onFocus={handleOnFocusSet}
                                    onChange={handleWeightChange}
                                    onKeyDown={(event) => handleNumericEnter(event, 'weight')}
                                    className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                                />
                            </label>
                            <label className="text-xs text-telegram-hint">
                                Длительность (сек)
                                <input
                                    ref={durationInputRef}
                                    type="number"
                                    min={0}
                                    inputMode="numeric"
                                    enterKeyHint="next"
                                    value={set.duration ?? ''}
                                    onFocus={handleOnFocusSet}
                                    onChange={handleDurationChange}
                                    onKeyDown={(event) => handleNumericEnter(event, 'duration')}
                                    className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                                />
                            </label>
                            <label className="text-xs text-telegram-hint">
                                Дистанция (км)
                                <input
                                    ref={distanceInputRef}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    inputMode="decimal"
                                    enterKeyHint="done"
                                    value={set.distance ?? ''}
                                    onFocus={handleOnFocusSet}
                                    onChange={handleDistanceChange}
                                    onKeyDown={(event) => handleNumericEnter(event, 'distance')}
                                    className="mt-0.5 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-sm text-telegram-text"
                                />
                            </label>
                        </div>
                    )}

                    {!isCardioSet && (
                        <div className="mt-2 space-y-2">
                            {/* Inline RPE for current set - always visible */}
                            {isCurrent ? (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="shrink-0 text-[11px] text-telegram-hint">RPE</span>
                                        {RPE_OPTIONS.map((value) => (
                                            <button
                                                key={`rpe-${value}`}
                                                type="button"
                                                onClick={() => handleRpeToggle(value)}
                                                className={`min-h-11 min-w-11 touch-manipulation rounded-xl text-sm font-semibold transition-colors ${set.rpe === value
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'
                                                    }`}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="shrink-0 text-[11px] text-telegram-hint">RIR</span>
                                        {RIR_OPTIONS.map((value) => (
                                            <button
                                                key={`rir-current-${value}`}
                                                type="button"
                                                onClick={() => handleRirToggle(value)}
                                                className={`min-h-11 min-w-11 touch-manipulation rounded-xl text-sm font-semibold transition-colors ${set.rir === value
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'
                                                    }`}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    )}
                </>
            ) : null}
        </div>
    )
})

ExerciseSetRow.displayName = 'ExerciseSetRow'

