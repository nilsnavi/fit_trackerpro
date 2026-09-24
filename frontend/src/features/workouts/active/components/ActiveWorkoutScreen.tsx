import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    Clock3,
    Dumbbell,
    Lock,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
} from 'lucide-react'

import { Button } from '@shared/ui/Button'
import { cn } from '@shared/lib/cn'
import { toast } from '@shared/stores/toastStore'
import { formatElapsedDuration } from '@features/workouts/active/lib/activeWorkoutUtils'
import { useRestTimer } from '@features/workouts/active/hooks/useRestTimer'
import { useWorkoutSetWrites } from '@features/workouts/active/hooks/useWorkoutSetWrites'
import type {
    CompletedExercise,
    CompletedSet,
    WeightRecommendationResponse,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'
import { PreviousResultCard } from './PreviousResultCard'
import { PlateCalculatorModal } from './PlateCalculatorModal'
import type { ProgressionRecommendation as Recommendation } from '../hooks/useProgressionRecommendation'
import { ProgressionPrefillNotice } from './ProgressionPrefillNotice'
import type { PreviousExerciseResult } from '../lib/previousResult'

// Loaded on demand so the active-workout route chunk stays inside its budget.
const ProgressionRecommendationCard = lazy(() =>
    import('./ProgressionRecommendationCard').then((module) => ({
        default: module.ProgressionRecommendationCard,
    })),
)

type ProgressionExplanationSet = {
    set_number?: number
    reps?: number | null
    weight?: number | null
    duration?: number | null
}
import {
    groupExerciseWithNext,
    supersetSlots,
    ungroupExercise,
    type SupersetSlot,
} from '../lib/supersetGrouping'
import {
    appendPrefilledSet,
    DEFAULT_TIMED_SET_SECONDS,
    isTimedSet,
} from '../lib/activeWorkoutUtils'

// SPEC-005 §14: RPE 1–10 with 0.5 step.
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const
// SPEC-005 §10: allowed set types.
const SET_TYPE_OPTIONS: Array<{ value: CompletedSet['set_type']; label: string }> = [
    { value: 'warmup', label: 'W' },
    { value: 'working', label: 'W+' },
    { value: 'dropset', label: 'D' },
    { value: 'failure', label: 'F' },
]
// SPEC-005 §12: quick weight deltas.
const WEIGHT_DELTAS = [-5, -2.5, 2.5, 5] as const

type PatchItemFn = (recipe: (prev: WorkoutHistoryItem) => WorkoutHistoryItem) => void
type UpdateSetFn = (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void

function recommendationLabel(recommendation?: WeightRecommendationResponse): { text: string; tone: 'neutral' | 'warning' } | null {
    const suggestedWeight = recommendation?.suggested_weight
    if (typeof suggestedWeight !== 'number') return null

    if (recommendation?.recommendation === 'decrease') {
        return {
            text: `⚠️ RPE высокий. Лучше снизить до ${formatKg(suggestedWeight)} кг`,
            tone: 'warning',
        }
    }

    return {
        text: `💡 Следующий подход: ${formatKg(suggestedWeight)} кг`,
        tone: 'neutral',
    }
}

export interface ActiveWorkoutScreenProps {
    workoutId: number
    workout: WorkoutHistoryItem
    workoutTitle: string
    elapsedSeconds: number
    currentExerciseIndex: number
    currentSetIndex: number
    previousBestByExercise: Map<string, CompletedSet>
    /** SPEC-005 §8: previous completed result for the active exercise. */
    previousResult?: PreviousExerciseResult | null
    /** SPEC-005 §37: explainable progression recommendation. */
    progressionRecommendation?: Recommendation | null
    isProgressionLoading?: boolean
    isProgressionError?: boolean
    /** SPEC-006 §42–§44: explicit accept/modify/reject for a stored recommendation. */
    onAcceptProgression?: (recommendation: Recommendation, selectedValue?: number) => void
    onRejectProgression?: (recommendation: Recommendation) => void
    isProgressionDeciding?: boolean
    /** SPEC-006 §46: previous sets shown in the "Почему?" sheet. */
    progressionPreviousSets?: ProgressionExplanationSet[]
    /** SPEC-006 §58: undo the accepted target that seeded the active exercise. */
    onRevertProgressionPrefill?: (exerciseIndex: number) => void
    weightRecommendation?: WeightRecommendationResponse
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    isSavingSet: boolean
    finishWarning?: string | null
    onBack: () => void
    onSelectExercise: (exerciseIndex: number) => void
    onPatchWorkout: PatchItemFn
    onUpdateSet: UpdateSetFn
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onNotifySetCompleted: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
    onAddExercise: () => void
    onFinishWorkout: () => void
    /** SPEC-005 §26: skip exercise (session-only). */
    onSkipExercise?: (exerciseIndex: number) => void
    /** SPEC-005 §26: un-skip a skipped exercise. */
    onUnskipExercise?: (exerciseIndex: number) => void
}

function formatKg(value: number | undefined): string {
    if (value == null || !Number.isFinite(value)) return '0'
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getActiveSetIndex(exercise: CompletedExercise, currentSetIndex: number): number {
    const clamped = Math.min(Math.max(currentSetIndex, 0), Math.max(0, exercise.sets_completed.length - 1))
    const current = exercise.sets_completed[clamped]
    if (current && !current.completed) return clamped

    const next = exercise.sets_completed.findIndex((set) => !set.completed)
    return next >= 0 ? next : Math.max(0, exercise.sets_completed.length - 1)
}

function countCompletedSets(workout: WorkoutHistoryItem): number {
    return workout.exercises.reduce(
        (sum, exercise) => sum + exercise.sets_completed.filter((set) => set.completed).length,
        0,
    )
}

function countTotalSets(workout: WorkoutHistoryItem): number {
    return workout.exercises.reduce((sum, exercise) => sum + exercise.sets_completed.length, 0)
}

function countCompletedExercises(workout: WorkoutHistoryItem): number {
    return workout.exercises.filter(
        (exercise) => exercise.sets_completed.length > 0 && exercise.sets_completed.every((set) => set.completed),
    ).length
}

const WorkoutTopBar = memo(function WorkoutTopBar({
    title,
    elapsedLabel,
    onBack,
}: {
    title: string
    elapsedLabel: string
    onBack: () => void
}) {
    return (
        <header className="pt-[max(0px,env(safe-area-inset-top))]">
            <div className="flex min-h-12 items-center gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-[#F8FAFC] active:bg-white/10"
                    aria-label="Назад"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-xl font-black leading-tight text-[#F8FAFC]">{title}</h1>
                    <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#8A94A6]">
                        <span className="flex items-center gap-1 tabular-nums">
                            <Clock3 className="h-3.5 w-3.5" />
                            {elapsedLabel}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[#8A94A6]" />
                        <span>LIVE</span>
                    </div>
                </div>
                <button
                    type="button"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-[#F8FAFC] active:bg-white/10"
                    aria-label="Меню тренировки"
                >
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </div>
        </header>
    )
})

const WorkoutProgress = memo(function WorkoutProgress({
    completedExercises,
    totalExercises,
    completedSets,
    totalSets,
}: {
    completedExercises: number
    totalExercises: number
    completedSets: number
    totalSets: number
}) {
    const percent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0

    return (
        <section className="rounded-[22px] border border-white/[0.08] bg-[#101720] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#8A94A6]">Прогресс</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-[#F8FAFC]">
                        {completedExercises}/{totalExercises}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black tabular-nums text-[#4ADE80]">{percent}%</p>
                    <p className="text-xs font-semibold text-[#8A94A6]">
                        {completedSets}/{totalSets} подходов
                    </p>
                </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/35">
                <div
                    className="h-full rounded-full bg-[#4ADE80] shadow-[0_0_22px_rgba(74,222,128,0.35)] transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
            </div>
        </section>
    )
})

function InlineRestTimer() {
    const { isVisible, remainingLabel, progressPercent, skip, reset, adjust } = useRestTimer()

    if (!isVisible) return null

    return (
        <div className="rounded-[18px] border border-[#60A5FA]/20 bg-[#0B1626] p-3">
            <div className="flex min-h-12 items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-base font-black tabular-nums text-[#F8FAFC]">Отдых {remainingLabel}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                            className="h-full rounded-full bg-[#60A5FA] transition-[width] duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
                {/* SPEC-005 §17: -30 / +30 quick adjustments beside skip. */}
                <button
                    type="button"
                    onClick={() => adjust(-30)}
                    data-testid="rest-minus-30"
                    aria-label="Минус 30 секунд"
                    className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-white/[0.06] px-2 text-xs font-black tabular-nums text-[#F8FAFC] active:bg-white/10"
                >
                    −30
                </button>
                <button
                    type="button"
                    onClick={skip}
                    className="min-h-11 rounded-2xl bg-white/[0.06] px-3 text-sm font-bold text-[#F8FAFC] active:bg-white/10"
                >
                    Пропустить
                </button>
                <button
                    type="button"
                    onClick={() => adjust(30)}
                    data-testid="rest-plus-30"
                    aria-label="Плюс 30 секунд"
                    className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-white/[0.06] px-2 text-xs font-black tabular-nums text-[#F8FAFC] active:bg-white/10"
                >
                    +30
                </button>
                <button
                    type="button"
                    onClick={reset}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-[#F8FAFC] active:bg-white/10"
                    aria-label="Сбросить таймер"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

function SetStatusCell({
    state,
    onComplete,
    disabled,
}: {
    state: 'completed' | 'active' | 'locked'
    onComplete: () => void
    disabled: boolean
}) {
    if (state === 'completed') {
        return (
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C55E]/15 text-[#4ADE80]">
                <CheckCircle2 className="h-5 w-5" />
            </span>
        )
    }

    if (state === 'locked') {
        return (
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#64748B]">
                <Lock className="h-5 w-5" />
            </span>
        )
    }

    return (
        <button
            type="button"
            onClick={onComplete}
            disabled={disabled}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C55E] text-white shadow-[0_10px_24px_rgba(34,197,94,0.25)] active:scale-95 disabled:opacity-50"
            aria-label="Завершить подход"
        >
            <Check className="h-5 w-5" />
        </button>
    )
}

function SetsTable({
    exercise,
    exerciseIndex,
    currentSetIndex,
    isSaving,
    errorMessage,
    onUpdateSet,
    onUpdateSetRpe,
    onCompleteActiveSet,
    onOpenPlateCalculator,
    onAddSet,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    currentSetIndex: number
    isSaving: boolean
    errorMessage: string | null
    onUpdateSet: UpdateSetFn
    onUpdateSetRpe: (set: CompletedSet, rpe: number) => void
    onCompleteActiveSet: (set: CompletedSet) => void
    onOpenPlateCalculator?: (targetWeight: number) => void
    /** SPEC-005 §11: append a set prefilled from the previous working set. */
    onAddSet?: () => void
}) {
    const activeSetIndex = getActiveSetIndex(exercise, currentSetIndex)
    const activeSet = exercise.sets_completed[activeSetIndex] ?? null
    const [editingSetNumber, setEditingSetNumber] = useState<number | null>(activeSet?.set_number ?? null)

    useEffect(() => {
        setEditingSetNumber(activeSet?.set_number ?? null)
    }, [activeSet?.set_number, exerciseIndex])

    if (exercise.sets_completed.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-black/20 p-4 text-sm font-semibold text-[#8A94A6]">
                Нет подходов
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-black/20">
                <div className="grid grid-cols-[0.7fr_1fr_1fr_3.25rem] gap-2 border-b border-white/[0.06] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#8A94A6]">
                    <span>Подход</span>
                    <span>Вес</span>
                    <span>Повторы</span>
                    <span className="text-center">Статус</span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                    {exercise.sets_completed.map((set, index) => {
                        const state = set.completed ? 'completed' : index === activeSetIndex ? 'active' : 'locked'
                        const isActive = state === 'active'
                        const isEditing = isActive && editingSetNumber === set.set_number
                        const canComplete = isActive && !isSaving
                        // SPEC-005 §20: timed sets show duration instead of reps.
                        const isTimed = isTimedSet(set)
                        const isWarmup = set.set_type === 'warmup'

                        return (
                            <div
                                key={set.set_number}
                                className={cn(
                                    'grid min-h-[64px] grid-cols-[0.7fr_1fr_1fr_3.25rem] items-center gap-2 px-3 py-2',
                                    isActive && 'bg-[#162033]',
                                    state === 'locked' && 'opacity-60',
                                    isWarmup && 'bg-[#FACC15]/[0.04]',
                                )}
                                data-testid={`set-row-${set.set_number}`}
                            >
                                <span className="text-sm font-black tabular-nums text-[#F8FAFC]">
                                    {set.set_type === 'warmup' ? 'W' : '#'}{isWarmup ? set.set_number : set.set_number}
                                </span>

                                {isEditing ? (
                                    <>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="0.5"
                                            value={set.weight ?? ''}
                                            onChange={(event) => onUpdateSet(exerciseIndex, set.set_number, { weight: event.target.value === '' ? undefined : Number(event.target.value) })}
                                            className="h-12 min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B1118] px-3 text-base font-black tabular-nums text-[#F8FAFC] outline-none focus:border-[#4ADE80]"
                                            aria-label="Вес"
                                        />
                                        {isTimed ? (
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                value={set.duration ?? ''}
                                                onChange={(event) => onUpdateSet(exerciseIndex, set.set_number, { duration: event.target.value === '' ? undefined : Number.parseInt(event.target.value, 10) })}
                                                className="h-12 min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B1118] px-3 text-base font-black tabular-nums text-[#F8FAFC] outline-none focus:border-[#4ADE80]"
                                                aria-label="Длительность, сек"
                                            />
                                        ) : (
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                max={999}
                                                value={set.reps ?? ''}
                                                onChange={(event) => onUpdateSet(exerciseIndex, set.set_number, { reps: event.target.value === '' ? undefined : Number.parseInt(event.target.value, 10) })}
                                                className="h-12 min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B1118] px-3 text-base font-black tabular-nums text-[#F8FAFC] outline-none focus:border-[#4ADE80]"
                                                aria-label="Повторы"
                                            />
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onOpenPlateCalculator?.(set.weight ?? 0)}
                                            className="truncate text-left text-base font-black tabular-nums text-[#F8FAFC]"
                                            title="Рассчитать блины"
                                        >
                                            {formatKg(set.weight)} кг
                                        </button>
                                        <span className="text-base font-black tabular-nums text-[#F8FAFC]">
                                            {isTimed ? `${set.duration} сек` : set.reps ?? 0}
                                        </span>
                                    </>
                                )}

                                <SetStatusCell state={state} onComplete={() => onCompleteActiveSet(set)} disabled={!canComplete} />

                                {isActive ? (
                                    <div className="col-span-4 space-y-2 pt-1">
                                        {/* SPEC-005 §10: set type quick switch. */}
                                        <div className="flex items-center gap-2" data-testid="set-type-switch">
                                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-[#8A94A6]">Тип</span>
                                            <div className="grid flex-1 grid-cols-4 gap-1.5">
                                                {SET_TYPE_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => onUpdateSet(exerciseIndex, set.set_number, { set_type: option.value })}
                                                        className={cn(
                                                            'min-h-9 rounded-xl border text-xs font-black',
                                                            (set.set_type ?? 'working') === option.value
                                                                ? 'border-[#60A5FA]/60 bg-[#60A5FA]/20 text-[#DBEAFE]'
                                                                : 'border-white/[0.08] bg-white/[0.04] text-[#8A94A6] active:bg-white/[0.08]',
                                                        )}
                                                        aria-label={`Тип подхода: ${option.value}`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {/* SPEC-005 §20: measurement toggle — reps or time. */}
                                        <div className="flex items-center gap-2" data-testid="set-measure-switch">
                                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-[#8A94A6]">Измерение</span>
                                            <div className="grid flex-1 grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    data-testid="set-measure-reps"
                                                    onClick={() => onUpdateSet(exerciseIndex, set.set_number, {
                                                        reps: set.reps ?? 10,
                                                        duration: undefined,
                                                    })}
                                                    className={cn(
                                                        'min-h-9 rounded-xl border text-xs font-black',
                                                        !isTimed
                                                            ? 'border-[#4ADE80]/60 bg-[#4ADE80]/20 text-[#DCFCE7]'
                                                            : 'border-white/[0.08] bg-white/[0.04] text-[#8A94A6] active:bg-white/[0.08]',
                                                    )}
                                                >
                                                    Повторы
                                                </button>
                                                <button
                                                    type="button"
                                                    data-testid="set-measure-time"
                                                    onClick={() => onUpdateSet(exerciseIndex, set.set_number, {
                                                        duration: set.duration ?? DEFAULT_TIMED_SET_SECONDS,
                                                        reps: undefined,
                                                    })}
                                                    className={cn(
                                                        'min-h-9 rounded-xl border text-xs font-black',
                                                        isTimed
                                                            ? 'border-[#4ADE80]/60 bg-[#4ADE80]/20 text-[#DCFCE7]'
                                                            : 'border-white/[0.08] bg-white/[0.04] text-[#8A94A6] active:bg-white/[0.08]',
                                                    )}
                                                >
                                                    Время
                                                </button>
                                            </div>
                                        </div>
                                        {/* SPEC-005 §12: quick weight controls. */}
                                        <div className="flex items-center gap-1.5" data-testid="weight-quick-controls">
                                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-[#8A94A6]">Вес</span>
                                            <div className="grid flex-1 grid-cols-4 gap-1.5">
                                                {WEIGHT_DELTAS.map((delta) => (
                                                    <button
                                                        key={delta}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = typeof set.weight === 'number' ? set.weight : 0
                                                            const next = Math.max(0, Number((current + delta).toFixed(2)))
                                                            onUpdateSet(exerciseIndex, set.set_number, { weight: next })
                                                        }}
                                                        className="min-h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-black tabular-nums text-[#F8FAFC] active:bg-white/[0.08]"
                                                    >
                                                        {delta > 0 ? `+${delta}` : delta}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-[#8A94A6]">RPE</span>
                                            <div className="grid flex-1 grid-cols-5 gap-1.5">
                                                {RPE_OPTIONS.slice(0, 5).map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => onUpdateSetRpe(set, value)}
                                                        className={cn(
                                                            'min-h-9 rounded-xl border text-sm font-black tabular-nums',
                                                            set.rpe === value
                                                                ? 'border-[#FACC15]/60 bg-[#FACC15]/20 text-[#FEF3C7]'
                                                                : 'border-white/[0.08] bg-white/[0.04] text-[#8A94A6] active:bg-white/[0.08]',
                                                        )}
                                                    >
                                                        {value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-transparent">RPE</span>
                                            <div className="grid flex-1 grid-cols-5 gap-1.5">
                                                {RPE_OPTIONS.slice(5).map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => onUpdateSetRpe(set, value)}
                                                        className={cn(
                                                            'min-h-9 rounded-xl border text-sm font-black tabular-nums',
                                                            set.rpe === value
                                                                ? 'border-[#FACC15]/60 bg-[#FACC15]/20 text-[#FEF3C7]'
                                                                : 'border-white/[0.08] bg-white/[0.04] text-[#8A94A6] active:bg-white/[0.08]',
                                                        )}
                                                    >
                                                        {value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditingSetNumber(isEditing ? null : set.set_number)}
                                                className="flex min-h-12 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] text-[#F8FAFC] active:bg-white/10"
                                                aria-label="Редактировать подход"
                                            >
                                                <Pencil className="h-5 w-5" />
                                            </button>
                                            <Button
                                                type="button"
                                                className="min-h-12 flex-1 rounded-2xl bg-[#22C55E] text-base font-black text-white hover:bg-[#16A34A]"
                                                onClick={() => onCompleteActiveSet(set)}
                                                disabled={!canComplete}
                                                isLoading={isSaving}
                                            >
                                                Завершить подход
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            </div>
            {/* SPEC-005 §11: add set, prefilled from the previous working set. */}
            {onAddSet ? (
                <button
                    type="button"
                    data-testid="add-set-btn"
                    onClick={onAddSet}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/[0.14] bg-white/[0.02] text-sm font-black text-[#8A94A6] active:bg-white/[0.06]"
                >
                    <Plus className="h-4 w-4" />
                    Добавить подход
                </button>
            ) : null}
            {errorMessage ? (
                <p className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm font-semibold text-[#FCA5A5]">
                    {errorMessage}
                </p>
            ) : null}
        </div>
    )
}

function ExerciseMenu({
    onReplace,
    onDelete,
    onSkip,
    onUnskip,
    isSkipped,
    onGroupWithNext,
    onUngroup,
    isInBlock,
}: {
    onReplace: () => void
    onDelete: () => void
    onSkip?: () => void
    onUnskip?: () => void
    isSkipped?: boolean
    /** SPEC-005 §21: group this exercise with the next one into a superset block. */
    onGroupWithNext?: () => void
    /** SPEC-005 §21: remove this exercise from its block. */
    onUngroup?: () => void
    isInBlock?: boolean
}) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation()
                    setOpen((value) => !value)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-[#F8FAFC] active:bg-white/10"
                aria-label="Меню упражнения"
            >
                <MoreHorizontal className="h-5 w-5" />
            </button>
            {open ? (
                <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151C26] shadow-2xl">
                    <button
                        type="button"
                        className="block min-h-12 w-full px-4 text-left text-sm font-bold text-[#F8FAFC]"
                        onClick={(event) => {
                            event.stopPropagation()
                            setOpen(false)
                            onReplace()
                        }}
                    >
                        Заменить
                    </button>
                    {onSkip && !isSkipped ? (
                        <button
                            type="button"
                            data-testid="exercise-skip-btn"
                            className="block min-h-12 w-full px-4 text-left text-sm font-bold text-[#FACC15]"
                            onClick={(event) => {
                                event.stopPropagation()
                                setOpen(false)
                                onSkip()
                            }}
                        >
                            Пропустить
                        </button>
                    ) : null}
                    {onUnskip && isSkipped ? (
                        <button
                            type="button"
                            data-testid="exercise-unskip-btn"
                            className="block min-h-12 w-full px-4 text-left text-sm font-bold text-[#4ADE80]"
                            onClick={(event) => {
                                event.stopPropagation()
                                setOpen(false)
                                onUnskip()
                            }}
                        >
                            Вернуть в тренировку
                        </button>
                    ) : null}
                    {onGroupWithNext ? (
                        <button
                            type="button"
                            data-testid="exercise-superset-btn"
                            className="block min-h-12 w-full px-4 text-left text-sm font-bold text-[#60A5FA]"
                            onClick={(event) => {
                                event.stopPropagation()
                                setOpen(false)
                                onGroupWithNext()
                            }}
                        >
                            В суперсет с следующим
                        </button>
                    ) : null}
                    {onUngroup && isInBlock ? (
                        <button
                            type="button"
                            data-testid="exercise-unsuperset-btn"
                            className="block min-h-12 w-full px-4 text-left text-sm font-bold text-[#93C5FD]"
                            onClick={(event) => {
                                event.stopPropagation()
                                setOpen(false)
                                onUngroup()
                            }}
                        >
                            Убрать из суперсета
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-bold text-[#EF4444]"
                        onClick={(event) => {
                            event.stopPropagation()
                            setOpen(false)
                            onDelete()
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                    </button>
                </div>
            ) : null}
        </div>
    )
}

function CollapsedExerciseCard({
    exercise,
    exerciseIndex,
    slot,
    onSelect,
    onReplace,
    onDelete,
    onSkip,
    onUnskip,
    onGroupWithNext,
    onUngroup,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    /** SPEC-005 §21: superset block presentation for this exercise. */
    slot?: SupersetSlot
    onSelect: (index: number) => void
    onReplace: () => void
    onDelete: () => void
    onSkip?: () => void
    onUnskip?: () => void
    onGroupWithNext?: () => void
    onUngroup?: () => void
}) {
    const isSkipped = exercise.status === 'skipped'
    const completed = exercise.sets_completed.filter((set) => set.completed).length
    const total = exercise.sets_completed.length

    return (
        <div
            className={cn(
                'rounded-[20px] border bg-[#101720] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)]',
                isSkipped ? 'border-white/[0.05] opacity-70' : 'border-white/[0.08]',
            )}
            data-testid={isSkipped ? 'exercise-card-skipped' : 'exercise-card'}
        >
            {slot?.header ? (
                <p
                    data-testid="superset-block-header"
                    className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#60A5FA]"
                >
                    {slot.header}
                </p>
            ) : null}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => onSelect(exerciseIndex)}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-[#8A94A6]">
                        <Dumbbell className={cn('h-5 w-5', isSkipped && 'line-through')} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-base font-black text-[#F8FAFC]', isSkipped && 'line-through')}>
                            {exercise.name}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#8A94A6]">
                            {isSkipped ? 'Пропущено' : `${completed}/${total} подходов`}
                            {slot?.label ? (
                                <span
                                    data-testid="exercise-block-label"
                                    className="rounded-md bg-[#60A5FA]/15 px-1.5 py-0.5 font-black text-[#93C5FD]"
                                >
                                    {slot.label}
                                </span>
                            ) : null}
                        </span>
                    </span>
                </button>
                <ExerciseMenu
                    onReplace={onReplace}
                    onDelete={onDelete}
                    onSkip={onSkip}
                    onUnskip={onUnskip}
                    isSkipped={isSkipped}
                    onGroupWithNext={onGroupWithNext}
                    onUngroup={onUngroup}
                    isInBlock={Boolean(slot?.label)}
                />
            </div>
        </div>
    )
}

function WeightRecommendationInline({
    recommendation,
    isLoading,
    isError,
}: {
    recommendation?: WeightRecommendationResponse
    isLoading: boolean
    isError: boolean
}) {
    if (isLoading) {
        return (
            <div className="rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-2 text-sm font-bold text-[#8A94A6]">
                Расчёт...
            </div>
        )
    }

    if (isError) {
        return (
            <div className="rounded-[16px] border border-white/[0.06] bg-black/10 px-3 py-2 text-xs font-semibold text-[#64748B]">
                Рекомендация недоступна
            </div>
        )
    }

    const label = recommendationLabel(recommendation)
    if (!label) return null

    return (
        <div
            className={cn(
                'rounded-[16px] border px-3 py-2 text-sm font-black',
                label.tone === 'warning'
                    ? 'border-[#FACC15]/25 bg-[#FACC15]/10 text-[#FEF3C7]'
                    : 'border-[#60A5FA]/20 bg-[#60A5FA]/10 text-[#DBEAFE]',
            )}
        >
            {label.text}
        </div>
    )
}

function ActiveExerciseCard({
    workoutId,
    exercise,
    exerciseIndex,
    currentSetIndex,
    isSaving,
    recommendation,
    isWeightRecLoading,
    isWeightRecError,
    previousResult,
    progressionRecommendation,
    isProgressionLoading,
    isProgressionError,
    onAcceptProgression,
    onRejectProgression,
    isProgressionDeciding,
    progressionPreviousSets,
    onRevertProgressionPrefill,
    onUpdateSet,
    onPatchWorkout,
    onNotifySetCompleted,
    onSetLastCompletedSet,
    onSetCurrentPosition,
    onAddExercise,
    onSelectExercise,
    exercises,
    slot,
    onGroupWithNext,
    onUngroup,
}: {
    workoutId: number
    exercise: CompletedExercise
    exerciseIndex: number
    currentSetIndex: number
    isSaving: boolean
    recommendation?: WeightRecommendationResponse
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    previousResult?: PreviousExerciseResult | null
    progressionRecommendation?: Recommendation | null
    isProgressionLoading?: boolean
    isProgressionError?: boolean
    onAcceptProgression?: (recommendation: Recommendation, selectedValue?: number) => void
    onRejectProgression?: (recommendation: Recommendation) => void
    isProgressionDeciding?: boolean
    progressionPreviousSets?: ProgressionExplanationSet[]
    /** SPEC-006 §58: undo the accepted target that seeded this exercise. */
    onRevertProgressionPrefill?: () => void
    onUpdateSet: UpdateSetFn
    onPatchWorkout: PatchItemFn
    onNotifySetCompleted: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onAddExercise: () => void
    onSelectExercise: (exerciseIndex: number) => void
    exercises: CompletedExercise[]
    /** SPEC-005 §21: superset block presentation for the active exercise. */
    slot?: SupersetSlot
    onGroupWithNext?: () => void
    onUngroup?: () => void
}) {
    const completed = exercise.sets_completed.filter((set) => set.completed).length
    const total = exercise.sets_completed.length
    const [completionError, setCompletionError] = useState<string | null>(null)
    // SPEC-005 §42: plate calculator state.
    const [isPlateCalculatorOpen, setIsPlateCalculatorOpen] = useState(false)
    const [plateTargetWeight, setPlateTarget] = useState(0)

    const deleteExercise = useCallback(() => {
        const shouldDelete = window.confirm('Удалить упражнение из тренировки?')
        if (!shouldDelete) return
        onPatchWorkout((prev) => ({ ...prev, exercises: prev.exercises.filter((_, index) => index !== exerciseIndex) }))
        onNotifySetCompleted()
        toast.info('Упражнение удалено')
    }, [exerciseIndex, onNotifySetCompleted, onPatchWorkout])

    // SPEC-005 §11: new set inherits the previous working set's values.
    const addSet = useCallback(() => {
        onPatchWorkout((prev) => ({
            ...prev,
            exercises: prev.exercises.map((item, index) =>
                index === exerciseIndex ? appendPrefilledSet(item) : item,
            ),
        }))
        onNotifySetCompleted()
    }, [exerciseIndex, onNotifySetCompleted, onPatchWorkout])

    // SPEC-005 §11/§17/§47: завершение подхода, его RPE и рекомендация по весу — во владельце записи.
    const { completeSet, updateSetRpe } = useWorkoutSetWrites({
        workoutId,
        exercise,
        exerciseIndex,
        exercises,
        onUpdateSet,
        onSetLastCompletedSet,
        onSetCurrentPosition,
        onSelectExercise,
        onNotifySetCompleted,
        onCompletionError: setCompletionError,
    })

    return (
        <section className="rounded-[24px] border border-[#4ADE80]/25 bg-[#111821] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-wide text-[#4ADE80]">Активное</p>
                        {slot?.label ? (
                            <span
                                data-testid="active-superset-badge"
                                className="rounded-md bg-[#60A5FA]/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#93C5FD]"
                            >
                                {slot.header ? `${slot.header} · ` : 'SUPERSET · '}
                                {slot.label}
                            </span>
                        ) : null}
                    </div>
                    <h2 className="mt-1 text-xl font-black leading-tight text-[#F8FAFC]">{exercise.name}</h2>
                    <p className="mt-2 text-sm font-semibold text-[#8A94A6]">
                        {completed}/{total} подходов
                    </p>
                </div>
                <ExerciseMenu
                    onReplace={onAddExercise}
                    onDelete={deleteExercise}
                    onGroupWithNext={onGroupWithNext}
                    onUngroup={onUngroup}
                    isInBlock={Boolean(slot?.label)}
                />
            </div>

            <div className="mt-4 space-y-3">
                <InlineRestTimer />
                {/* SPEC-005 §8: previous completed result. */}
                <PreviousResultCard previous={previousResult} />
                {/* SPEC-005 §37 / SPEC-006 §45: explainable progression recommendation. */}
                <Suspense
                    fallback={
                        <div className="rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-2 text-sm font-bold text-telegram-hint">
                            Расчёт рекомендации...
                        </div>
                    }
                >
                    <ProgressionRecommendationCard
                        recommendation={progressionRecommendation}
                        isLoading={isProgressionLoading}
                        isError={isProgressionError}
                        onAccept={onAcceptProgression}
                        onReject={onRejectProgression}
                        isDeciding={isProgressionDeciding}
                        previousSets={progressionPreviousSets}
                        onApply={(value) => {
                            const nextIncomplete = exercise.sets_completed.find((set) => !set.completed)
                            if (nextIncomplete) {
                                onUpdateSet(exerciseIndex, nextIncomplete.set_number, { weight: value })
                            }
                        }}
                    />
                </Suspense>
                <ProgressionPrefillNotice
                    exercise={exercise}
                    onRevert={onRevertProgressionPrefill}
                    className="mt-3"
                />
                <WeightRecommendationInline
                    recommendation={recommendation}
                    isLoading={isWeightRecLoading}
                    isError={isWeightRecError}
                />
                <SetsTable
                    exercise={exercise}
                    exerciseIndex={exerciseIndex}
                    currentSetIndex={currentSetIndex}
                    isSaving={isSaving}
                    errorMessage={completionError}
                    onUpdateSet={onUpdateSet}
                    onUpdateSetRpe={updateSetRpe}
                    onCompleteActiveSet={completeSet}
                    onOpenPlateCalculator={(weight) => {
                        // SPEC-005 §42: the weight cell opens the plate calculator.
                        setPlateTarget(weight)
                        setIsPlateCalculatorOpen(true)
                    }}
                    onAddSet={addSet}
                />
            </div>

            <PlateCalculatorModal
                isOpen={isPlateCalculatorOpen}
                onClose={() => setIsPlateCalculatorOpen(false)}
                targetWeight={plateTargetWeight}
                exerciseName={exercise.name}
            />
        </section>
    )
}

function WorkoutBottomBar({
    isSavingSet,
    onAddExercise,
    onFinishWorkout,
}: {
    isSavingSet: boolean
    onAddExercise: () => void
    onFinishWorkout: () => void
}) {
    return (
        <div className="fixed bottom-[var(--app-shell-nav-h)] left-0 right-0 z-20 border-t border-white/[0.08] bg-[#090D12]/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur">
            <div className="mx-auto grid max-w-screen-sm grid-cols-[1fr_1fr] gap-2">
                <Button type="button" variant="secondary" className="min-h-[54px] rounded-2xl border-white/[0.08] bg-[#151C26] text-[#F8FAFC]" onClick={onAddExercise}>
                    <Plus className="mr-1 h-5 w-5" />
                    Упражнение
                </Button>
                <Button type="button" className="min-h-[54px] rounded-2xl bg-[#22C55E] font-black text-white hover:bg-[#16A34A]" onClick={onFinishWorkout} disabled={isSavingSet}>
                    <Check className="mr-1 h-5 w-5" />
                    Завершить
                </Button>
            </div>
        </div>
    )
}

export function ActiveWorkoutScreen({
    workoutId,
    workout,
    workoutTitle,
    elapsedSeconds,
    currentExerciseIndex,
    currentSetIndex,
    previousResult,
    progressionRecommendation,
    isProgressionLoading,
    isProgressionError,
    onAcceptProgression,
    onRejectProgression,
    isProgressionDeciding,
    progressionPreviousSets,
    onRevertProgressionPrefill,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    isSavingSet,
    finishWarning,
    onBack,
    onSelectExercise,
    onPatchWorkout,
    onUpdateSet,
    onSetCurrentPosition,
    onNotifySetCompleted,
    onSetLastCompletedSet,
    onAddExercise,
    onFinishWorkout,
    onSkipExercise,
    onUnskipExercise,
}: ActiveWorkoutScreenProps) {
    const elapsedLabel = formatElapsedDuration(elapsedSeconds)
    const completedSets = useMemo(() => countCompletedSets(workout), [workout])
    const totalSets = useMemo(() => countTotalSets(workout), [workout])
    const completedExercises = useMemo(() => countCompletedExercises(workout), [workout])
    const activeExerciseIndex = workout.exercises[currentExerciseIndex] ? currentExerciseIndex : 0

    const deleteExercise = useCallback(
        (exerciseIndex: number) => {
            const shouldDelete = window.confirm('Удалить упражнение из тренировки?')
            if (!shouldDelete) return
            onPatchWorkout((prev) => ({ ...prev, exercises: prev.exercises.filter((_, index) => index !== exerciseIndex) }))
            onNotifySetCompleted()
            toast.info('Упражнение удалено')
        },
        [onNotifySetCompleted, onPatchWorkout],
    )

    // SPEC-005 §21: superset/triset/circuit blocks are session-only.
    const blockSlots = useMemo(() => supersetSlots(workout), [workout])

    const groupWithNext = useCallback(
        (exerciseIndex: number) => {
            onPatchWorkout((prev) => groupExerciseWithNext(prev, exerciseIndex))
            onNotifySetCompleted()
            toast.info('Упражнения объединены в суперсет')
        },
        [onNotifySetCompleted, onPatchWorkout],
    )

    const ungroup = useCallback(
        (exerciseIndex: number) => {
            onPatchWorkout((prev) => ungroupExercise(prev, exerciseIndex))
            onNotifySetCompleted()
            toast.info('Упражнение убрано из суперсета')
        },
        [onNotifySetCompleted, onPatchWorkout],
    )

    if (workout.exercises.length === 0) {
        return (
            <div className="min-h-full bg-[#090D12] p-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
                <WorkoutTopBar title={workoutTitle} elapsedLabel={elapsedLabel} onBack={onBack} />
                <div className="mt-6 rounded-[22px] border border-dashed border-white/[0.08] bg-[#101720] p-5 text-center">
                    <p className="text-sm font-semibold text-[#8A94A6]">Нет упражнений</p>
                    <Button type="button" className="mt-4 w-full rounded-2xl" onClick={onAddExercise}>
                        Добавить упражнение
                    </Button>
                </div>
                <WorkoutBottomBar isSavingSet={isSavingSet} onAddExercise={onAddExercise} onFinishWorkout={onFinishWorkout} />
            </div>
        )
    }

    return (
        <div className="min-h-full bg-[#090D12] p-4 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto max-w-screen-sm space-y-4">
                <WorkoutTopBar title={workoutTitle} elapsedLabel={elapsedLabel} onBack={onBack} />
                <WorkoutProgress
                    completedExercises={completedExercises}
                    totalExercises={workout.exercises.length}
                    completedSets={completedSets}
                    totalSets={totalSets}
                />

                <div className="space-y-3">
                    {workout.exercises.map((exercise, index) => {
                        const isActive = index === activeExerciseIndex
                        if (isActive) {
                            return (
                                <ActiveExerciseCard
                                    key={`${exercise.exercise_id}-${index}`}
                                    workoutId={workoutId}
                                    exercise={exercise}
                                    exerciseIndex={index}
                                    currentSetIndex={currentExerciseIndex === index ? currentSetIndex : 0}
                                    isSaving={isSavingSet}
                                    recommendation={weightRecommendation}
                                    isWeightRecLoading={isWeightRecLoading}
                                    isWeightRecError={isWeightRecError}
                                    previousResult={previousResult}
                                    progressionRecommendation={progressionRecommendation}
                                    isProgressionLoading={isProgressionLoading}
                                    isProgressionError={isProgressionError}
                                    onAcceptProgression={onAcceptProgression}
                                    onRejectProgression={onRejectProgression}
                                    isProgressionDeciding={isProgressionDeciding}
                                    progressionPreviousSets={progressionPreviousSets}
                                    onRevertProgressionPrefill={() => onRevertProgressionPrefill?.(index)}
                                    onUpdateSet={onUpdateSet}
                                    onPatchWorkout={onPatchWorkout}
                                    onNotifySetCompleted={onNotifySetCompleted}
                                    onSetLastCompletedSet={onSetLastCompletedSet}
                                    onSetCurrentPosition={onSetCurrentPosition}
                                    onAddExercise={onAddExercise}
                                    onSelectExercise={onSelectExercise}
                                    exercises={workout.exercises}
                                    slot={blockSlots[index]}
                                    onGroupWithNext={() => groupWithNext(index)}
                                    onUngroup={() => ungroup(index)}
                                />
                            )
                        }

                        return (
                            <CollapsedExerciseCard
                                key={`${exercise.exercise_id}-${index}`}
                                exercise={exercise}
                                exerciseIndex={index}
                                onSelect={onSelectExercise}
                                onReplace={onAddExercise}
                                onDelete={() => deleteExercise(index)}
                                onSkip={onSkipExercise ? () => onSkipExercise(index) : undefined}
                                onUnskip={onUnskipExercise ? () => onUnskipExercise(index) : undefined}
                                slot={blockSlots[index]}
                                onGroupWithNext={index < workout.exercises.length - 1 ? () => groupWithNext(index) : undefined}
                                onUngroup={() => ungroup(index)}
                            />
                        )
                    })}
                </div>
                {finishWarning ? (
                    <div className="rounded-[18px] border border-[#FACC15]/25 bg-[#FACC15]/10 px-4 py-3 text-sm font-bold text-[#FEF3C7]">
                        {finishWarning}
                    </div>
                ) : null}
            </div>

            <WorkoutBottomBar isSavingSet={isSavingSet} onAddExercise={onAddExercise} onFinishWorkout={onFinishWorkout} />
        </div>
    )
}
