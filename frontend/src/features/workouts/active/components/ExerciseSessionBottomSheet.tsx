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

function isCardioLikeSet(set: CompletedSet | undefined): boolean {
    if (!set) return false
    return (
        typeof set.duration === 'number' &&
        set.duration > 0 &&
        set.weight == null &&
        set.reps == null
    )
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
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    onFocusPosition: (exerciseIndex: number, setIndex: number) => void
    onCompleteSet: (exerciseIndex: number, setNumber: number) => void
    onSkipSet: () => void
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
    onUpdateSet,
    onFocusPosition,
    onCompleteSet,
    onSkipSet,
    onUpdateSetRpe,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
}: ExerciseSessionBottomSheetProps) {
    const [exerciseDoneFlash, setExerciseDoneFlash] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            setExerciseDoneFlash(false)
        }
    }, [isOpen])

    const meta = useMemo(() => getExerciseSummaryMeta(exercise), [exercise])
    const session = useMemo(
        () => deriveExerciseSessionState(exercise, exerciseIndex, currentExerciseIndex, currentSetIndex),
        [exercise, exerciseIndex, currentExerciseIndex, currentSetIndex],
    )

    const currentSet = exercise.sets_completed[normalizedCurrentSetIndex]
    const isCurrentContext = exerciseIndex === currentExerciseIndex && !readOnly && sessionStatus === 'current'
    const cardio = isCardioLikeSet(currentSet)

    const progressSegments = useMemo(() => {
        return exercise.sets_completed.map((set, setIndex) => {
            let tone: 'done' | 'current' | 'pending' = 'pending'
            if (set.completed || (exerciseIndex === currentExerciseIndex && setIndex < normalizedCurrentSetIndex) || exerciseIndex < currentExerciseIndex) {
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
        if (first?.duration != null) parts.push(`${first.duration} сек`)
        return parts.join(' · ')
    }, [exercise.sets_completed, meta.label])

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

    const adjustDuration = useCallback(
        (delta: number) => {
            if (!currentSet || readOnly || !isCurrentContext) return
            const base = typeof currentSet.duration === 'number' ? currentSet.duration : 0
            onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
            onUpdateSet(exerciseIndex, currentSet.set_number, { duration: Math.max(0, base + delta) })
        },
        [currentSet, exerciseIndex, isCurrentContext, normalizedCurrentSetIndex, onFocusPosition, onUpdateSet, readOnly],
    )

    const handleCompleteClick = useCallback(() => {
        if (!currentSet || readOnly || !isCurrentContext) return
        const isLastInExercise = normalizedCurrentSetIndex >= exercise.sets_completed.length - 1
        onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
        onCompleteSet(exerciseIndex, currentSet.set_number)
        if (isLastInExercise) {
            setExerciseDoneFlash(true)
            window.setTimeout(() => {
                setExerciseDoneFlash(false)
                onClose()
            }, 600)
        }
    }, [
        currentSet,
        exerciseIndex,
        isCurrentContext,
        normalizedCurrentSetIndex,
        onClose,
        onCompleteSet,
        onFocusPosition,
        readOnly,
        exercise.sets_completed.length,
    ])

    const handleSkipClick = useCallback(() => {
        if (!currentSet || readOnly || !isCurrentContext) return
        const isLastInExercise = normalizedCurrentSetIndex >= exercise.sets_completed.length - 1
        onFocusPosition(exerciseIndex, normalizedCurrentSetIndex)
        onSkipSet()
        if (isLastInExercise) {
            setExerciseDoneFlash(true)
            window.setTimeout(() => {
                setExerciseDoneFlash(false)
                onClose()
            }, 600)
        }
    }, [
        currentSet,
        exerciseIndex,
        isCurrentContext,
        normalizedCurrentSetIndex,
        onClose,
        onFocusPosition,
        onSkipSet,
        readOnly,
        exercise.sets_completed.length,
    ])

    const firstRpeGap = useMemo(() => {
        const target = exercise.sets_completed.find((s) => s.completed && s.rpe == null)
        return target ?? null
    }, [exercise.sets_completed])

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

                {exerciseDoneFlash ? (
                    <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-8">
                        <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">✓ Упражнение завершено</p>
                    </div>
                ) : readOnly || sessionStatus === 'done' ? (
                    <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                        <p className="text-xs font-medium uppercase tracking-wide text-telegram-hint">Подходы</p>
                        {exercise.sets_completed.map((set) => (
                            <div
                                key={set.set_number}
                                className="flex items-center justify-between rounded-xl border border-border bg-telegram-bg px-3 py-2 text-sm"
                            >
                                <span className="text-telegram-hint">#{set.set_number}</span>
                                <span className="font-medium text-telegram-text">
                                    {set.completed ? (
                                        <>
                                            {set.reps != null ? `${set.reps}×` : null}
                                            {set.weight != null ? ` ${set.weight} кг` : null}
                                            {set.duration != null ? ` ${set.duration} сек` : null}
                                            {set.rpe != null ? ` · RPE ${set.rpe}` : null}
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {isCurrentContext && weightRecommendation && (weightRecommendation.suggested_weight || weightRecommendation.message) ? (
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

                        {cardio ? (
                            <div className="mt-4">
                                <NumberStepper
                                    label="Длительность (сек)"
                                    value={String(currentSet?.duration ?? 0)}
                                    onDec={() => adjustDuration(-10)}
                                    onInc={() => adjustDuration(10)}
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
                                    value={typeof currentSet?.weight === 'number' ? currentSet.weight.toFixed(1).replace(/\.0$/, '') : '0'}
                                    unit="кг"
                                    onDec={() => adjustWeight(-WEIGHT_STEP)}
                                    onInc={() => adjustWeight(WEIGHT_STEP)}
                                    disabled={!isCurrentContext}
                                />
                            </div>
                        )}

                        {isCurrentContext ? (
                            <div className="mt-6 flex flex-col gap-3">
                                <Button type="button" variant="secondary" className="w-full border-border" onClick={handleSkipClick}>
                                    Пропустить
                                </Button>
                                <Button type="button" className="w-full" onClick={handleCompleteClick}>
                                    ✓ Подход выполнен
                                </Button>
                            </div>
                        ) : null}

                        {firstRpeGap != null && isCurrentContext ? (
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

                <button
                    type="button"
                    className="mt-auto pt-4 text-center text-sm font-medium text-primary"
                    onClick={onClose}
                >
                    Закрыть
                </button>
            </div>
        </Modal>
    )
})

ExerciseSessionBottomSheet.displayName = 'ExerciseSessionBottomSheet'
