import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'
import { cn } from '@shared/lib/cn'
import { getExerciseSummaryMeta } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import {
    deriveExerciseSessionState,
    type ExerciseSessionStatus,
} from '@features/workouts/active/lib/exerciseSessionDerivation'

const RPE_OPTIONS = [6, 7, 8, 9, 10]
const WEIGHT_STEP = 2.5
const REPS_STEP = 1
const REST_PRESET_SECONDS = [30, 60, 90, 120] as const

function isCardioDurationOnlySet(set: CompletedSet | undefined): boolean {
    if (!set) return false
    return (
        typeof set.duration === 'number' &&
        set.duration > 0 &&
        set.weight == null &&
        set.reps == null
    )
}

function roundToStep(value: number, step: number): number {
    return Math.round(value / step) * step
}

function NumberStepper({
    label,
    value,
    onDec,
    onInc,
    disabled,
    unit,
}: {
    label: string
    value: string
    onDec: () => void
    onInc: () => void
    disabled?: boolean
    unit?: string
}) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-telegram-hint">{label}</span>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-telegram-bg px-2 py-2">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onDec}
                    className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-telegram-secondary-bg text-lg font-semibold text-telegram-text disabled:opacity-40"
                >
                    −
                </button>
                <span className="min-w-[4rem] text-center text-lg font-bold tabular-nums text-telegram-text">
                    {value}
                    {unit ? <span className="text-sm font-medium text-telegram-hint"> {unit}</span> : null}
                </span>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onInc}
                    className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-telegram-secondary-bg text-lg font-semibold text-telegram-text disabled:opacity-40"
                >
                    +
                </button>
            </div>
        </div>
    )
}

type SetRowKind = 'completed' | 'skipped' | 'current' | 'pending'

function getSetRowKind(
    exerciseIndex: number,
    setIndex: number,
    set: CompletedSet,
    currentExerciseIndex: number,
    normalizedCurrentSetIndex: number,
    staticView: boolean,
): SetRowKind {
    if (staticView) {
        if (set.completed) return 'completed'
        return 'skipped'
    }
    const passed =
        exerciseIndex < currentExerciseIndex ||
        (exerciseIndex === currentExerciseIndex && setIndex < normalizedCurrentSetIndex)
    if (set.completed) return 'completed'
    if (passed) return 'skipped'
    if (exerciseIndex === currentExerciseIndex && setIndex === normalizedCurrentSetIndex) return 'current'
    return 'pending'
}

export interface ExerciseSessionBottomSheetProps {
    isOpen: boolean
    onClose: () => void
    exercise: CompletedExercise
    exerciseIndex: number
    readOnly: boolean
    sessionStatus: ExerciseSessionStatus
    currentExerciseIndex: number
    currentSetIndex: number
    normalizedCurrentSetIndex: number
    isTreadmill: boolean
    defaultRestSeconds: number
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    onFocusPosition: (exerciseIndex: number, setIndex: number) => void
    onCompleteSet: (opts: { restEnabled: boolean; restSeconds: number }) => void
    onSkipSet: (opts: { restEnabled: boolean; restSeconds: number }) => void
    onUpdateSetRpe: (exerciseIndex: number, setNumber: number, rpe: number) => void
    weightRecommendation?: { suggested_weight?: number; message?: string }
    isWeightRecLoading?: boolean
    isWeightRecError?: boolean
}

export const ExerciseSessionBottomSheet = memo(function ExerciseSessionBottomSheet({
    isOpen,
    onClose,
    exercise,
    exerciseIndex,
    readOnly,
    sessionStatus,
    currentExerciseIndex,
    currentSetIndex,
    normalizedCurrentSetIndex,
    isTreadmill,
    defaultRestSeconds,
    onUpdateSet,
    onFocusPosition,
    onCompleteSet,
    onSkipSet,
    onUpdateSetRpe,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
}: ExerciseSessionBottomSheetProps) {
    const [restEnabled, setRestEnabled] = useState(true)
    const [restPresetSeconds, setRestPresetSeconds] = useState(() => {
        const d = defaultRestSeconds
        return REST_PRESET_SECONDS.includes(d as (typeof REST_PRESET_SECONDS)[number]) ? d : 90
    })

    useEffect(() => {
        if (!isOpen) return
        const d = defaultRestSeconds
        setRestPresetSeconds(REST_PRESET_SECONDS.includes(d as (typeof REST_PRESET_SECONDS)[number]) ? d : 90)
    }, [defaultRestSeconds, isOpen])

    const meta = useMemo(() => getExerciseSummaryMeta(exercise), [exercise])
    const session = useMemo(
        () => deriveExerciseSessionState(exercise, exerciseIndex, currentExerciseIndex, currentSetIndex),
        [exercise, exerciseIndex, currentExerciseIndex, currentSetIndex],
    )

    const currentSet = exercise.sets_completed[normalizedCurrentSetIndex]
    const isCurrentContext = exerciseIndex === currentExerciseIndex && !readOnly && sessionStatus === 'current'
    const pureCardioDuration = !isTreadmill && isCardioDurationOnlySet(currentSet)

    const progressSegments = useMemo(() => {
        return exercise.sets_completed.map((set, setIndex) => {
            let tone: 'done' | 'current' | 'pending' = 'pending'
            if (
                set.completed ||
                (exerciseIndex === currentExerciseIndex && setIndex < normalizedCurrentSetIndex) ||
                exerciseIndex < currentExerciseIndex
            ) {
                tone = 'done'
            } else if (exerciseIndex === currentExerciseIndex && setIndex === normalizedCurrentSetIndex) {
                tone = 'current'
            }
            return { key: set.set_number, tone }
        })
    }, [exercise.sets_completed, exerciseIndex, currentExerciseIndex, normalizedCurrentSetIndex])

    const metaLine = useMemo(() => {
        const n = exercise.sets_completed.length
        const first = exercise.sets_completed[0]
        const parts = [meta.label, `${n}×`]
        if (first?.reps != null) parts.push(`${first.reps} повт`)
        if (first?.weight != null) parts.push(`${first.weight} кг`)
        if (first?.duration != null && !isTreadmill) parts.push(`${first.duration} сек`)
        return parts.join(' · ')
    }, [exercise.sets_completed, meta.label, isTreadmill])

    const adjustReps = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const base = typeof currentSet.reps === 'number' ? currentSet.reps : 0
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            onUpdateSet(exerciseIndex, currentSet.set_number, { reps: Math.max(0, Math.round(base + delta)) })
        },
        [currentSet, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly],
    )

    const adjustWeight = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const base = typeof currentSet.weight === 'number' ? currentSet.weight : 0
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            const next = Math.round((base + delta) * 10) / 10
            onUpdateSet(exerciseIndex, currentSet.set_number, { weight: Math.max(0, next) })
        },
        [currentSet, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly],
    )

    const adjustDurationSeconds = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const base = typeof currentSet.duration === 'number' ? currentSet.duration : 0
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            onUpdateSet(exerciseIndex, currentSet.set_number, { duration: Math.max(0, base + delta) })
        },
        [currentSet, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly],
    )

    const durationMinutes = useMemo(() => {
        const sec = typeof currentSet?.duration === 'number' ? currentSet.duration : 0
        return Math.max(1, Math.round(sec / 60) || 1)
    }, [currentSet?.duration])

    const adjustTreadmillMinutes = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const nextMin = Math.max(1, durationMinutes + delta)
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            onUpdateSet(exerciseIndex, currentSet.set_number, { duration: nextMin * 60 })
        },
        [currentSet, durationMinutes, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly],
    )

    const speedValue = typeof currentSet?.speed_kmh === 'number' ? currentSet.speed_kmh : 0
    const inclineValue = typeof currentSet?.incline_pct === 'number' ? currentSet.incline_pct : 0

    const adjustSpeed = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const next = roundToStep(Math.max(0, speedValue + delta), 0.5)
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            onUpdateSet(exerciseIndex, currentSet.set_number, { speed_kmh: next })
        },
        [currentSet, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly, speedValue],
    )

    const adjustIncline = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const next = roundToStep(Math.max(0, inclineValue + delta), 0.5)
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            onUpdateSet(exerciseIndex, currentSet.set_number, { incline_pct: next })
        },
        [currentSet, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly, inclineValue],
    )

    const handleCompleteClick = useCallback(() => {
        if (!currentSet || readOnly || !isCurrentContext) return
        onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
        onCompleteSet({ restEnabled, restSeconds: restPresetSeconds })
    }, [
        currentSet,
        exerciseIndex,
        isCurrentContext,
        normalizedCurrentSetIndex,
        onCompleteSet,
        onFocusPosition,
        readOnly,
        restEnabled,
        restPresetSeconds,
    ])

    const handleSkipClick = useCallback(() => {
        if (!currentSet || readOnly || !isCurrentContext) return
        onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
        onSkipSet({ restEnabled, restSeconds: restPresetSeconds })
    }, [
        currentSet,
        exerciseIndex,
        isCurrentContext,
        normalizedCurrentSetIndex,
        onFocusPosition,
        onSkipSet,
        readOnly,
        restEnabled,
        restPresetSeconds,
    ])

    const firstRpeGap = useMemo(() => {
        const target = exercise.sets_completed.find((s) => s.completed && s.rpe == null)
        return target ?? null
    }, [exercise.sets_completed])

    const showStrengthRpe = !isTreadmill && !pureCardioDuration

    return (
        <Modal isOpen={isOpen} onClose={onClose} showHandle className="!h-[70dvh] !max-h-[70dvh] sm:!max-h-[70vh]" closeOnOverlayClick>
            <div className="flex h-full max-h-[inherit] flex-col px-4 pb-4 pt-1">
                <div className="min-w-0 shrink-0 border-b border-border pb-3">
                    <h2 className="text-lg font-bold leading-snug text-telegram-text">{exercise.name}</h2>
                    <p className="mt-1 text-sm text-telegram-hint">{metaLine}</p>
                </div>

                {!(readOnly || sessionStatus === 'done') ? (
                    <>
                        <div className="mt-4 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-telegram-secondary-bg">
                            {progressSegments.map((seg) => (
                                <div
                                    key={seg.key}
                                    className={cn(
                                        'h-full min-w-[4px] flex-1 rounded-full transition-colors',
                                        seg.tone === 'done' && 'bg-emerald-500',
                                        seg.tone === 'current' && 'bg-primary',
                                        seg.tone === 'pending' && 'bg-telegram-hint/20',
                                    )}
                                />
                            ))}
                        </div>

                        <p className="mt-3 text-sm font-medium text-telegram-text">
                            Подход {normalizedCurrentSetIndex + 1} из {session.totalSets}
                        </p>
                    </>
                ) : null}

                {readOnly || sessionStatus === 'done' ? (
                    <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                        <SetHistoryTable
                            exercise={exercise}
                            exerciseIndex={exerciseIndex}
                            currentExerciseIndex={currentExerciseIndex}
                            normalizedCurrentSetIndex={normalizedCurrentSetIndex}
                            isTreadmill={isTreadmill}
                            staticView
                        />
                    </div>
                ) : (
                    <>
                        <div className="mt-4 flex-1 overflow-y-auto">
                            <SetHistoryTable
                                exercise={exercise}
                                exerciseIndex={exerciseIndex}
                                currentExerciseIndex={currentExerciseIndex}
                                normalizedCurrentSetIndex={normalizedCurrentSetIndex}
                                isTreadmill={isTreadmill}
                                staticView={false}
                            />
                        </div>

                        {isCurrentContext && weightRecommendation && (weightRecommendation.suggested_weight || weightRecommendation.message) && !isTreadmill ? (
                            <div className="mt-3 rounded-xl border border-primary/35 bg-primary/5 p-3 text-xs">
                                <p className="font-semibold text-primary">Рекомендация веса</p>
                                {isWeightRecLoading ? <p className="mt-1 text-telegram-hint">Загрузка…</p> : null}
                                {isWeightRecError ? <p className="mt-1 text-danger">Не удалось загрузить</p> : null}
                                {weightRecommendation.suggested_weight != null ? (
                                    <p className="mt-1 text-telegram-text">{weightRecommendation.suggested_weight} кг</p>
                                ) : null}
                                {weightRecommendation.message ? <p className="mt-1 text-telegram-hint">{weightRecommendation.message}</p> : null}
                            </div>
                        ) : null}

                        {isTreadmill ? (
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <NumberStepper
                                    label="Длительность (мин)"
                                    value={String(durationMinutes)}
                                    onDec={() => adjustTreadmillMinutes(-1)}
                                    onInc={() => adjustTreadmillMinutes(1)}
                                    disabled={!isCurrentContext}
                                />
                                <NumberStepper
                                    label="Скорость (км/ч)"
                                    value={speedValue.toFixed(1).replace(/\.0$/, '')}
                                    onDec={() => adjustSpeed(-0.5)}
                                    onInc={() => adjustSpeed(0.5)}
                                    disabled={!isCurrentContext}
                                />
                                <NumberStepper
                                    label="Наклон (%)"
                                    value={inclineValue.toFixed(1).replace(/\.0$/, '')}
                                    onDec={() => adjustIncline(-0.5)}
                                    onInc={() => adjustIncline(0.5)}
                                    disabled={!isCurrentContext}
                                />
                            </div>
                        ) : pureCardioDuration ? (
                            <div className="mt-4">
                                <NumberStepper
                                    label="Длительность (сек)"
                                    value={String(currentSet?.duration ?? 0)}
                                    onDec={() => adjustDurationSeconds(-10)}
                                    onInc={() => adjustDurationSeconds(10)}
                                    disabled={!isCurrentContext}
                                />
                            </div>
                        ) : (
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <NumberStepper
                                    label="Повторы"
                                    value={String(currentSet?.reps ?? 0)}
                                    onDec={() => adjustReps(-REPS_STEP)}
                                    onInc={() => adjustReps(REPS_STEP)}
                                    disabled={!isCurrentContext}
                                />
                                <NumberStepper
                                    label="Вес"
                                    value={
                                        typeof currentSet?.weight === 'number' ? currentSet.weight.toFixed(1).replace(/\.0$/, '') : '0'
                                    }
                                    unit="кг"
                                    onDec={() => adjustWeight(-WEIGHT_STEP)}
                                    onInc={() => adjustWeight(WEIGHT_STEP)}
                                    disabled={!isCurrentContext}
                                />
                            </div>
                        )}

                        <div className="mt-5 rounded-xl border border-border bg-telegram-secondary-bg/60 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-telegram-text">Отдых между подходами</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={restEnabled}
                                    onClick={() => setRestEnabled((v) => !v)}
                                    className={cn(
                                        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                                        restEnabled ? 'bg-primary' : 'bg-telegram-hint/30',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                                            restEnabled ? 'translate-x-5' : 'translate-x-0.5',
                                        )}
                                    />
                                </button>
                            </div>
                            {restEnabled ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {REST_PRESET_SECONDS.map((sec) => (
                                        <button
                                            key={sec}
                                            type="button"
                                            onClick={() => setRestPresetSeconds(sec)}
                                            className={cn(
                                                'min-h-10 flex-1 rounded-xl px-3 py-2 text-xs font-semibold sm:flex-none',
                                                restPresetSeconds === sec
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg',
                                            )}
                                        >
                                            {sec === 60 ? '1 мин' : sec === 90 ? '1.5 мин' : sec === 120 ? '2 мин' : `${sec}с`}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-telegram-hint/80">Таймер отдыха выключен</p>
                            )}
                        </div>

                        {isCurrentContext ? (
                            <div className="mt-4 flex flex-col gap-3">
                                <Button type="button" variant="secondary" className="w-full border-border" onClick={handleSkipClick}>
                                    Пропустить
                                </Button>
                                <Button type="button" className="w-full" onClick={handleCompleteClick}>
                                    ✓ Подход выполнен
                                </Button>
                            </div>
                        ) : null}

                        {firstRpeGap != null && isCurrentContext && showStrengthRpe ? (
                            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
                                <p className="text-xs font-medium text-telegram-text">Оцените усилие (RPE)</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {RPE_OPTIONS.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => {
                                                if (firstRpeGap) {
                                                    onUpdateSetRpe(exerciseIndex, firstRpeGap.set_number, value)
                                                }
                                            }}
                                            className="min-h-10 min-w-10 rounded-lg bg-telegram-bg text-sm font-semibold text-telegram-text active:bg-telegram-secondary-bg"
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                )}

                <button type="button" className="mt-auto pt-4 text-center text-sm font-medium text-primary" onClick={onClose}>
                    Закрыть
                </button>
            </div>
        </Modal>
    )
})

const SetHistoryTable = memo(function SetHistoryTable({
    exercise,
    exerciseIndex,
    currentExerciseIndex,
    normalizedCurrentSetIndex,
    isTreadmill,
    staticView,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    currentExerciseIndex: number
    normalizedCurrentSetIndex: number
    isTreadmill: boolean
    staticView: boolean
}) {
    const strengthVolumeTotal = useMemo(() => {
        if (isTreadmill) return null
        return exercise.sets_completed.reduce((acc, s) => {
            if (!s.completed) return acc
            const r = typeof s.reps === 'number' ? s.reps : 0
            const w = typeof s.weight === 'number' ? s.weight : 0
            return acc + r * w
        }, 0)
    }, [exercise.sets_completed, isTreadmill])

    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                <thead>
                    <tr className="border-b border-border bg-telegram-secondary-bg/80">
                        <th className="px-2 py-2 font-semibold text-telegram-hint">Подход</th>
                        {isTreadmill ? (
                            <>
                                <th className="px-2 py-2 font-semibold text-telegram-hint">Длит.</th>
                                <th className="px-2 py-2 font-semibold text-telegram-hint">Скорость</th>
                                <th className="px-2 py-2 font-semibold text-telegram-hint">Наклон</th>
                            </>
                        ) : (
                            <>
                                <th className="px-2 py-2 font-semibold text-telegram-hint">Повт.</th>
                                <th className="px-2 py-2 font-semibold text-telegram-hint">Вес</th>
                                <th className="px-2 py-2 font-semibold text-telegram-hint">Объём</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {exercise.sets_completed.map((set, setIndex) => {
                        const kind = getSetRowKind(
                            exerciseIndex,
                            setIndex,
                            set,
                            currentExerciseIndex,
                            normalizedCurrentSetIndex,
                            staticView,
                        )
                        const isSkippedRow = kind === 'skipped'
                        const isCurrent = kind === 'current'
                        const isDone = kind === 'completed'

                        const rowClass = cn(
                            'border-b border-border/60 last:border-b-0',
                            isDone && 'text-emerald-600 dark:text-emerald-400',
                            isCurrent && 'text-primary',
                            kind === 'pending' && 'text-telegram-hint/70',
                        )

                        const badgeClass = cn(
                            'inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                            isDone && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                            isSkippedRow && 'bg-telegram-hint/15 text-telegram-hint',
                            isCurrent && 'bg-primary/20 text-primary',
                            kind === 'pending' && 'bg-telegram-hint/10 text-telegram-hint',
                        )

                        const vol =
                            set.completed && typeof set.reps === 'number' && typeof set.weight === 'number'
                                ? set.reps * set.weight
                                : null

                        const durMin =
                            typeof set.duration === 'number' && set.duration > 0 ? Math.max(1, Math.round(set.duration / 60)) : null

                        return (
                            <tr key={set.set_number} className={rowClass}>
                                <td className="px-2 py-2 align-middle">
                                    <span className="inline-flex flex-wrap items-center gap-1">
                                        <span className={badgeClass}>#{set.set_number}</span>
                                        {isSkippedRow ? (
                                            <span className="rounded bg-telegram-hint/15 px-1.5 py-0.5 text-[10px] font-medium text-telegram-hint">
                                                пропущен
                                            </span>
                                        ) : null}
                                    </span>
                                </td>
                                {isTreadmill ? (
                                    <>
                                        <td className="px-2 py-2 align-middle">
                                            {isCurrent ? (
                                                <span className="font-medium">
                                                    {durMin != null ? `${durMin} мин` : '—'}
                                                    <span className="ml-1 text-[10px] text-primary">← текущий</span>
                                                </span>
                                            ) : isSkippedRow || !set.completed ? (
                                                '—'
                                            ) : (
                                                `${durMin ?? '—'} мин`
                                            )}
                                        </td>
                                        <td className="px-2 py-2 align-middle">
                                            {isCurrent ? (
                                                <span className="font-medium">
                                                    {typeof set.speed_kmh === 'number' ? `${set.speed_kmh} км/ч` : '—'}
                                                    <span className="ml-1 text-[10px] text-primary">← текущий</span>
                                                </span>
                                            ) : isSkippedRow || !set.completed ? (
                                                '—'
                                            ) : (
                                                `${typeof set.speed_kmh === 'number' ? `${set.speed_kmh} км/ч` : '—'}`
                                            )}
                                        </td>
                                        <td className="px-2 py-2 align-middle">
                                            {isCurrent ? (
                                                <span className="font-medium">
                                                    {typeof set.incline_pct === 'number' ? `${set.incline_pct}%` : '—'}
                                                    <span className="ml-1 text-[10px] text-primary">← текущий</span>
                                                </span>
                                            ) : isSkippedRow || !set.completed ? (
                                                '—'
                                            ) : (
                                                `${typeof set.incline_pct === 'number' ? `${set.incline_pct}%` : '—'}`
                                            )}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-2 py-2 align-middle">
                                            {isCurrent ? (
                                                <span className="font-medium">
                                                    {set.reps ?? '—'}
                                                    <span className="ml-1 text-[10px] text-primary">← текущий</span>
                                                </span>
                                            ) : isSkippedRow || !set.completed ? (
                                                '—'
                                            ) : (
                                                String(set.reps ?? '—')
                                            )}
                                        </td>
                                        <td className="px-2 py-2 align-middle">
                                            {isCurrent ? (
                                                <span className="font-medium">
                                                    {set.weight != null ? `${set.weight} кг` : '—'}
                                                    <span className="ml-1 text-[10px] text-primary">← текущий</span>
                                                </span>
                                            ) : isSkippedRow || !set.completed ? (
                                                '—'
                                            ) : (
                                                `${set.weight != null ? `${set.weight} кг` : '—'}`
                                            )}
                                        </td>
                                        <td className="px-2 py-2 align-middle">
                                            {isCurrent ? (
                                                <span className="font-medium">
                                                    {vol != null ? vol : '—'}
                                                    <span className="ml-1 text-[10px] text-primary">← текущий</span>
                                                </span>
                                            ) : isSkippedRow || !set.completed ? (
                                                '—'
                                            ) : vol != null ? (
                                                vol
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                    </>
                                )}
                            </tr>
                        )
                    })}
                </tbody>
                {!isTreadmill && strengthVolumeTotal != null ? (
                    <tfoot>
                        <tr className="border-t border-border bg-telegram-secondary-bg/40 text-telegram-hint">
                            <td colSpan={3} className="px-2 py-2 text-[11px] font-medium">
                                Сумма объёма (без пропусков)
                            </td>
                            <td className="px-2 py-2 text-[11px] font-semibold text-telegram-text">{strengthVolumeTotal}</td>
                        </tr>
                    </tfoot>
                ) : null}
            </table>
        </div>
    )
})

SetHistoryTable.displayName = 'SetHistoryTable'

ExerciseSessionBottomSheet.displayName = 'ExerciseSessionBottomSheet'
