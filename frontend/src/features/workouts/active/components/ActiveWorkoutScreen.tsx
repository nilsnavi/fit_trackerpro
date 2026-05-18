import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { cn } from '@shared/lib/cn'
import { getErrorMessage } from '@shared/errors'
import { toast } from '@shared/stores/toastStore'
import { formatElapsedDuration } from '@features/workouts/active/lib/activeWorkoutUtils'
import { useRestTimer } from '@features/workouts/active/hooks/useRestTimer'
import { weightRecommendationQueryKey } from '@features/workouts/active/hooks/useWeightRecommendation'
import type {
    CompletedExercise,
    CompletedSet,
    WeightRecommendationResponse,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'
import { useWorkoutSessionUiStore } from '@/state/local'

const DEFAULT_REST_SECONDS = 90
const RPE_OPTIONS = [6, 7, 8, 9, 10] as const

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
}

function formatKg(value: number | undefined): string {
    if (value == null || !Number.isFinite(value)) return '0'
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getRestSeconds(exercise: CompletedExercise): number {
    const planned = exercise.sets_completed.find((set) => typeof set.planned_rest_seconds === 'number')?.planned_rest_seconds
    const tracked = exercise.sets_completed.find((set) => typeof set.rest_seconds === 'number')?.rest_seconds
    return planned ?? tracked ?? DEFAULT_REST_SECONDS
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
    const { isVisible, remainingLabel, progressPercent, skip, reset } = useRestTimer()

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
                <button
                    type="button"
                    onClick={skip}
                    className="min-h-11 rounded-2xl bg-white/[0.06] px-3 text-sm font-bold text-[#F8FAFC] active:bg-white/10"
                >
                    Пропустить
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
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    currentSetIndex: number
    isSaving: boolean
    errorMessage: string | null
    onUpdateSet: UpdateSetFn
    onUpdateSetRpe: (set: CompletedSet, rpe: number) => void
    onCompleteActiveSet: (set: CompletedSet) => void
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

                        return (
                            <div
                                key={set.set_number}
                                className={cn(
                                    'grid min-h-[64px] grid-cols-[0.7fr_1fr_1fr_3.25rem] items-center gap-2 px-3 py-2',
                                    isActive && 'bg-[#162033]',
                                    state === 'locked' && 'opacity-60',
                                )}
                            >
                                <span className="text-sm font-black tabular-nums text-[#F8FAFC]">#{set.set_number}</span>

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
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            value={set.reps ?? ''}
                                            onChange={(event) => onUpdateSet(exerciseIndex, set.set_number, { reps: event.target.value === '' ? undefined : Number.parseInt(event.target.value, 10) })}
                                            className="h-12 min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B1118] px-3 text-base font-black tabular-nums text-[#F8FAFC] outline-none focus:border-[#4ADE80]"
                                            aria-label="Повторы"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <span className="text-base font-black tabular-nums text-[#F8FAFC]">{formatKg(set.weight)} кг</span>
                                        <span className="text-base font-black tabular-nums text-[#F8FAFC]">{set.reps ?? 0}</span>
                                    </>
                                )}

                                <SetStatusCell state={state} onComplete={() => onCompleteActiveSet(set)} disabled={!canComplete} />

                                {isActive ? (
                                    <div className="col-span-4 space-y-2 pt-1">
                                        <div className="flex items-center gap-2">
                                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-[#8A94A6]">RPE</span>
                                            <div className="grid flex-1 grid-cols-5 gap-1.5">
                                                {RPE_OPTIONS.map((value) => (
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
}: {
    onReplace: () => void
    onDelete: () => void
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
    onSelect,
    onReplace,
    onDelete,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    onSelect: (index: number) => void
    onReplace: () => void
    onDelete: () => void
}) {
    const completed = exercise.sets_completed.filter((set) => set.completed).length
    const total = exercise.sets_completed.length

    return (
        <div className="rounded-[20px] border border-white/[0.08] bg-[#101720] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => onSelect(exerciseIndex)}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-[#8A94A6]">
                        <Dumbbell className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-black text-[#F8FAFC]">{exercise.name}</span>
                        <span className="mt-1 block text-xs font-semibold text-[#8A94A6]">
                            {completed}/{total} подходов
                        </span>
                    </span>
                </button>
                <ExerciseMenu onReplace={onReplace} onDelete={onDelete} />
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
    onUpdateSet,
    onPatchWorkout,
    onNotifySetCompleted,
    onSetLastCompletedSet,
    onSetCurrentPosition,
    onAddExercise,
    onSelectExercise,
    exercises,
}: {
    workoutId: number
    exercise: CompletedExercise
    exerciseIndex: number
    currentSetIndex: number
    isSaving: boolean
    recommendation?: WeightRecommendationResponse
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    onUpdateSet: UpdateSetFn
    onPatchWorkout: PatchItemFn
    onNotifySetCompleted: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onAddExercise: () => void
    onSelectExercise: (exerciseIndex: number) => void
    exercises: CompletedExercise[]
}) {
    const queryClient = useQueryClient()
    const startRest = useWorkoutSessionUiStore((s) => s.startSessionRestTimer)
    const completed = exercise.sets_completed.filter((set) => set.completed).length
    const total = exercise.sets_completed.length
    const [completionError, setCompletionError] = useState<string | null>(null)

    const completeSetMutation = useMutation({
        mutationFn: async ({ setId, weight, reps, rpe }: { setId: number; weight: number; reps: number; rpe?: number }) =>
            workoutsApi.patchWorkoutSet(workoutId, setId, {
                weight,
                reps,
                ...(typeof rpe === 'number' ? { rpe } : {}),
                completed: true,
            }),
    })

    const patchSetRpeMutation = useMutation({
        mutationFn: async ({ setId, rpe }: { setId: number; rpe: number }) =>
            workoutsApi.patchWorkoutSet(workoutId, setId, { rpe }),
    })

    const refreshWeightRecommendation = useCallback(
        (nextSet?: CompletedSet) => {
            void queryClient.fetchQuery({
                queryKey: weightRecommendationQueryKey(workoutId, exercise.exercise_id),
                queryFn: () => workoutsApi.getWeightRecommendation(workoutId, exercise.exercise_id),
                staleTime: 0,
            }).then((nextRecommendation) => {
                if (!nextSet || typeof nextRecommendation.suggested_weight !== 'number') return
                onUpdateSet(exerciseIndex, nextSet.set_number, {
                    weight: nextRecommendation.suggested_weight,
                })
            }).catch(() => {
                // Recommendation is optional and must not block workout editing.
            })
        },
        [exercise.exercise_id, exerciseIndex, onUpdateSet, queryClient, workoutId],
    )

    const deleteExercise = useCallback(() => {
        const shouldDelete = window.confirm('Удалить упражнение из тренировки?')
        if (!shouldDelete) return
        onPatchWorkout((prev) => ({ ...prev, exercises: prev.exercises.filter((_, index) => index !== exerciseIndex) }))
        onNotifySetCompleted()
        toast.info('Упражнение удалено')
    }, [exerciseIndex, onNotifySetCompleted, onPatchWorkout])

    const completeSet = useCallback(
        async (set: CompletedSet) => {
            if (set.completed) return
            setCompletionError(null)

            const weight = typeof set.weight === 'number' ? set.weight : Number.NaN
            const reps = typeof set.reps === 'number' ? set.reps : Number.NaN
            if (!Number.isFinite(weight) || weight <= 0) {
                setCompletionError('Заполните вес больше 0')
                return
            }
            if (!Number.isFinite(reps) || reps <= 0) {
                setCompletionError('Заполните повторы больше 0')
                return
            }
            if (typeof set.id !== 'number' || set.id <= 0) {
                setCompletionError('Не удалось сохранить подход: отсутствует id set')
                return
            }

            try {
                const saved = await completeSetMutation.mutateAsync({
                    setId: set.id,
                    weight,
                    reps,
                    rpe: typeof set.rpe === 'number' ? set.rpe : undefined,
                })

                onUpdateSet(exerciseIndex, saved.set_number, {
                    id: saved.id,
                    weight: saved.weight ?? weight,
                    reps: saved.reps ?? reps,
                    rpe: saved.rpe == null ? undefined : Number(saved.rpe),
                    rest_seconds: saved.rest_seconds ?? undefined,
                    completed: saved.completed,
                    completed_at: new Date().toISOString(),
                    notes: saved.notes ?? undefined,
                })
                onSetLastCompletedSet({ exerciseIndex, setNumber: saved.set_number })

                const nextSetIndex = saved.set_number
                const nextSet = exercise.sets_completed[nextSetIndex]
                if (nextSet) {
                    onUpdateSet(exerciseIndex, nextSet.set_number, {
                        weight: saved.weight ?? weight,
                        reps: saved.reps ?? reps,
                    })
                    onSetCurrentPosition(exerciseIndex, nextSetIndex)
                    refreshWeightRecommendation(nextSet)
                    startRest({
                        forExerciseId: `${exercise.exercise_id}-${exerciseIndex}`,
                        exerciseIndex,
                        exerciseName: exercise.name,
                        nextSetOrdinal: nextSet.set_number,
                        totalSets: exercise.sets_completed.length,
                        total: getRestSeconds(exercise),
                    })
                } else {
                    const nextExerciseIndex = exercises.findIndex((_, index) => index > exerciseIndex)
                    if (nextExerciseIndex >= 0) {
                        onSetCurrentPosition(nextExerciseIndex, 0)
                        onSelectExercise(nextExerciseIndex)
                    } else {
                        toast.success('Все упражнения выполнены')
                    }
                }

                onNotifySetCompleted()
            } catch (error) {
                setCompletionError(`Не удалось сохранить подход: ${getErrorMessage(error)}`)
            }
        },
        [
            completeSetMutation,
            exercise,
            exerciseIndex,
            exercises,
            onNotifySetCompleted,
            onSelectExercise,
            onSetCurrentPosition,
            onSetLastCompletedSet,
            onUpdateSet,
            refreshWeightRecommendation,
            startRest,
        ],
    )

    const updateSetRpe = useCallback(
        (set: CompletedSet, rpe: number) => {
            onUpdateSet(exerciseIndex, set.set_number, { rpe })

            if (set.completed && typeof set.id === 'number' && set.id > 0) {
                void patchSetRpeMutation.mutateAsync({ setId: set.id, rpe })
                    .then(() => refreshWeightRecommendation(exercise.sets_completed[set.set_number]))
                    .catch(() => {
                        // Keep the UI non-blocking; the next sync/edit can retry this field.
                    })
                return
            }

            if (!set.completed) {
                void queryClient.invalidateQueries({
                    queryKey: weightRecommendationQueryKey(workoutId, exercise.exercise_id),
                })
            }
        },
        [exercise.exercise_id, exercise.sets_completed, exerciseIndex, onUpdateSet, patchSetRpeMutation, queryClient, refreshWeightRecommendation, workoutId],
    )

    return (
        <section className="rounded-[24px] border border-[#4ADE80]/25 bg-[#111821] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wide text-[#4ADE80]">Активное</p>
                    <h2 className="mt-1 text-xl font-black leading-tight text-[#F8FAFC]">{exercise.name}</h2>
                    <p className="mt-2 text-sm font-semibold text-[#8A94A6]">
                        {completed}/{total} подходов
                    </p>
                </div>
                <ExerciseMenu onReplace={onAddExercise} onDelete={deleteExercise} />
            </div>

            <div className="mt-4 space-y-3">
                <InlineRestTimer />
                <WeightRecommendationInline
                    recommendation={recommendation}
                    isLoading={isWeightRecLoading}
                    isError={isWeightRecError}
                />
                <SetsTable
                    exercise={exercise}
                    exerciseIndex={exerciseIndex}
                    currentSetIndex={currentSetIndex}
                    isSaving={isSaving || completeSetMutation.isPending}
                    errorMessage={completionError}
                    onUpdateSet={onUpdateSet}
                    onUpdateSetRpe={updateSetRpe}
                    onCompleteActiveSet={completeSet}
                />
            </div>
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
                                    onUpdateSet={onUpdateSet}
                                    onPatchWorkout={onPatchWorkout}
                                    onNotifySetCompleted={onNotifySetCompleted}
                                    onSetLastCompletedSet={onSetLastCompletedSet}
                                    onSetCurrentPosition={onSetCurrentPosition}
                                    onAddExercise={onAddExercise}
                                    onSelectExercise={onSelectExercise}
                                    exercises={workout.exercises}
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
