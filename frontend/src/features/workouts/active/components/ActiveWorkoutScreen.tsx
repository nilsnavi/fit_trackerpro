import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    Clock3,
    Dumbbell,
    Flame,
    Lightbulb,
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
import type {
    CompletedExercise,
    CompletedSet,
    WeightRecommendationResponse,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'
import { useWorkoutSessionUiStore } from '@/state/local'

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const
const DEFAULT_REST_SECONDS = 90

type PatchItemFn = (recipe: (prev: WorkoutHistoryItem) => WorkoutHistoryItem) => void
type UpdateSetFn = (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void

export interface ActiveWorkoutScreenProps {
    workoutId: number
    workout: WorkoutHistoryItem
    workoutTitle: string
    elapsedSeconds: number
    currentExerciseIndex: number
    previousBestByExercise: Map<string, CompletedSet>
    weightRecommendation?: WeightRecommendationResponse
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    isSavingSet: boolean
    onBack: () => void
    onSelectExercise: (exerciseIndex: number) => void
    onPatchWorkout: PatchItemFn
    onUpdateSet: UpdateSetFn
    onNotifySetCompleted: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
    onAddExercise: () => void
    onFinishWorkout: () => void
}

function formatKg(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function formatSetResult(set: CompletedSet | null): string {
    if (!set || set.weight == null || set.reps == null) return '—'
    return `${formatKg(set.weight)} кг x ${set.reps}`
}

function formatTimer(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function setVolume(set: CompletedSet): number {
    return (typeof set.weight === 'number' ? set.weight : 0) * (typeof set.reps === 'number' ? set.reps : 0)
}

function completedSets(workout: WorkoutHistoryItem): CompletedSet[] {
    return workout.exercises.flatMap((exercise) => exercise.sets_completed.filter((set) => set.completed))
}

function getLastCompletedSet(exercise: CompletedExercise): CompletedSet | null {
    return [...exercise.sets_completed].reverse().find((set) => set.completed) ?? null
}

function getBestSet(exercise: CompletedExercise, previousBest?: CompletedSet): CompletedSet | null {
    const currentBest = exercise.sets_completed
        .filter((set) => set.completed)
        .reduce<CompletedSet | null>((best, set) => (!best || setVolume(set) > setVolume(best) ? set : best), null)
    if (!previousBest) return currentBest
    if (!currentBest) return previousBest
    return setVolume(currentBest) >= setVolume(previousBest) ? currentBest : previousBest
}

function getRestSeconds(exercise: CompletedExercise): number {
    const planned = exercise.sets_completed.find((set) => typeof set.planned_rest_seconds === 'number')?.planned_rest_seconds
    const actual = exercise.sets_completed.find((set) => typeof set.rest_seconds === 'number')?.rest_seconds
    return planned ?? actual ?? DEFAULT_REST_SECONDS
}

function recommendationTone(rpe: number | undefined): { dot: string; text: string } {
    if (rpe == null) return { dot: 'text-[#8A94A6]', text: 'Рекомендация появится после следующего подхода' }
    if (rpe <= 7) return { dot: 'text-[#4ADE80]', text: 'Можно увеличить вес' }
    if (rpe === 8) return { dot: 'text-[#FACC15]', text: 'Хороший рабочий вес, можно оставить' }
    return { dot: 'text-[#EF4444]', text: 'Было тяжело, лучше снизить вес' }
}

function workoutStats(workout: WorkoutHistoryItem) {
    const sets = completedSets(workout)
    const totalVolume = sets.reduce((sum, set) => sum + setVolume(set), 0)
    return { totalSets: sets.length, totalVolume }
}

const WorkoutHeader = memo(function WorkoutHeader({
    title,
    elapsedLabel,
    exerciseCount,
    onBack,
}: {
    title: string
    elapsedLabel: string
    exerciseCount: number
    onBack: () => void
}) {
    return (
        <header className="flex items-start justify-between gap-3 pt-[max(0px,env(safe-area-inset-top))]">
            <button
                type="button"
                onClick={onBack}
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#F8FAFC] active:bg-white/10"
                aria-label="Назад"
            >
                <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <h1 className="line-clamp-1 text-lg font-extrabold leading-tight text-[#F8FAFC]">{title}</h1>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-[#F8FAFC]">
                        <Clock3 className="h-4 w-4 text-[#F8FAFC]" />
                        {elapsedLabel}
                    </span>
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#151C26] text-[#F8FAFC] shadow-[0_10px_30px_rgba(0,0,0,0.25)] active:bg-white/10"
                        aria-label="Меню тренировки"
                    >
                        <MoreHorizontal className="h-5 w-5" />
                    </button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[#8A94A6]">
                    <span>Сегодня · {exerciseCount} упражнений</span>
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#4ADE80]">
                        <span className="h-2 w-2 rounded-full bg-[#4ADE80]" />
                        LIVE
                    </span>
                </div>
            </div>
        </header>
    )
})

const LiveWorkoutStats = memo(function LiveWorkoutStats({
    elapsedLabel,
    totalSets,
    totalVolume,
}: {
    elapsedLabel: string
    totalSets: number
    totalVolume: number
}) {
    return (
        <section className="grid grid-cols-3 rounded-[20px] border border-white/[0.08] bg-[#111821]/90 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="flex flex-col items-center gap-1 border-r border-white/[0.06] px-2">
                <span className="inline-flex items-center gap-1 text-base font-extrabold tabular-nums text-[#F8FAFC]">
                    <Clock3 className="h-4 w-4 text-[#4ADE80]" />
                    {elapsedLabel}
                </span>
                <span className="text-xs text-[#8A94A6]">Время</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-r border-white/[0.06] px-2">
                <span className="inline-flex items-center gap-1 text-base font-extrabold tabular-nums text-[#F8FAFC]">
                    <Dumbbell className="h-4 w-4 text-[#60A5FA]" />
                    {totalSets}
                </span>
                <span className="text-xs text-[#8A94A6]">Подходов</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2">
                <span className="inline-flex items-center gap-1 text-base font-extrabold tabular-nums text-[#F8FAFC]">
                    <Flame className="h-4 w-4 text-[#FACC15]" />
                    {Math.round(totalVolume).toLocaleString('ru-RU')} кг
                </span>
                <span className="text-xs text-[#8A94A6]">Объём</span>
            </div>
        </section>
    )
})

const ExerciseTabs = memo(function ExerciseTabs({
    exercises,
    activeIndex,
    completedIndexes,
    onSelect,
}: {
    exercises: CompletedExercise[]
    activeIndex: number
    completedIndexes: Set<number>
    onSelect: (index: number) => void
}) {
    return (
        <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
            <div className="flex min-w-max gap-2">
                {exercises.map((exercise, index) => {
                    const active = index === activeIndex
                    const done = completedIndexes.has(index)
                    return (
                        <button
                            key={`${exercise.exercise_id}-${index}`}
                            type="button"
                            onClick={() => onSelect(index)}
                            className={cn(
                                'min-h-11 shrink-0 rounded-[14px] border px-3 py-2 text-sm font-bold transition-colors',
                                active
                                    ? 'border-[#4ADE80] bg-[#22C55E]/35 text-[#F8FAFC] shadow-[0_12px_28px_rgba(34,197,94,0.16)]'
                                    : 'border-white/[0.06] bg-[#151C26] text-[#CBD5E1] active:bg-white/10',
                            )}
                        >
                            {index + 1} {exercise.name}
                            {done ? ' ✓' : ''}
                        </button>
                    )
                })}
            </div>
        </nav>
    )
})

function WeightRecommendation({
    recommendation,
    isLoading,
    isError,
    lastRpe,
    fallbackWeight,
    fallbackReps,
}: {
    recommendation?: WeightRecommendationResponse
    isLoading: boolean
    isError: boolean
    lastRpe?: number
    fallbackWeight?: number
    fallbackReps?: number
}) {
    const tone = recommendationTone(lastRpe)
    const suggestedWeight = recommendation?.suggested_weight ?? fallbackWeight
    if (isLoading) {
        return <div className="rounded-[14px] border border-[#4ADE80]/20 bg-[#4ADE80]/10 p-3 text-sm font-semibold text-[#4ADE80]">Считаю следующий вес...</div>
    }
    if (isError || !recommendation || recommendation.recommendation === 'no_data') {
        if (import.meta.env.DEV && isError) {
            console.warn('Weight recommendation endpoint failed')
        }
        return (
            <div className="rounded-[14px] border border-white/[0.06] bg-[#090D12]/70 p-3 text-sm font-medium text-[#8A94A6]">
                Рекомендация появится после следующего подхода
            </div>
        )
    }
    return (
        <div className="rounded-[14px] border border-[#FACC15]/25 bg-[#FACC15]/10 p-3">
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#4ADE80]">
                    <Lightbulb className="h-5 w-5" />
                </span>
                <div className="min-w-0">
            <p className="text-base font-extrabold text-[#F8FAFC]">
                Следующий: {suggestedWeight != null ? `${formatKg(Number(suggestedWeight))} кг` : '—'} x {fallbackReps ?? 8}
            </p>
            <p className={cn('mt-1 text-sm font-medium', tone.dot)}>
                RPE {lastRpe ?? '—'} — {tone.text}
            </p>
                </div>
            </div>
        </div>
    )
}

function SetsList({
    exercise,
    exerciseIndex,
    onUpdateSet,
    onPatchWorkout,
    onNotifySetCompleted,
    onSetLastCompletedSet,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    onUpdateSet: UpdateSetFn
    onPatchWorkout: PatchItemFn
    onNotifySetCompleted: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
}) {
    const startSessionRestTimer = useWorkoutSessionUiStore((s) => s.startSessionRestTimer)
    const [editingKey, setEditingKey] = useState<number | null>(null)

    const update = useCallback(
        (set: CompletedSet, patch: Partial<CompletedSet>) => {
            onUpdateSet(exerciseIndex, set.set_number, patch)
        },
        [exerciseIndex, onUpdateSet],
    )

    const complete = useCallback(
        (set: CompletedSet) => {
            if (set.completed) return

            update(set, {
                completed: true,
                completed_at: new Date().toISOString(),
            })
            setEditingKey(null)
            onSetLastCompletedSet({ exerciseIndex, setNumber: set.set_number })
            onNotifySetCompleted()

            const restSeconds = getRestSeconds(exercise)
            const nextSetOrdinal = set.set_number + 1
            if (nextSetOrdinal <= exercise.sets_completed.length) {
                startSessionRestTimer({
                    forExerciseId: `${exercise.exercise_id}-${exerciseIndex}`,
                    exerciseIndex,
                    exerciseName: exercise.name,
                    nextSetOrdinal,
                    totalSets: exercise.sets_completed.length,
                    total: restSeconds,
                })
            } else {
                toast.success('Все подходы упражнения выполнены')
            }
        },
        [
            exercise,
            exerciseIndex,
            onNotifySetCompleted,
            onSetLastCompletedSet,
            startSessionRestTimer,
            update,
        ],
    )

    const remove = useCallback(
        (setNumber: number) => {
            // TODO: replace full-session fallback with DELETE /workouts/{workout_id}/sets/{set_id} if backend adds it.
            onPatchWorkout((prev) => ({
                ...prev,
                exercises: prev.exercises.map((item, index) => {
                    if (index !== exerciseIndex) return item
                    return {
                        ...item,
                        sets_completed: item.sets_completed
                            .filter((set) => set.set_number !== setNumber)
                            .map((set, nextIndex) => ({ ...set, set_number: nextIndex + 1 })),
                    }
                }),
            }))
            onNotifySetCompleted()
            toast.info('Подход удалён')
        },
        [exerciseIndex, onNotifySetCompleted, onPatchWorkout],
    )

    if (exercise.sets_completed.length === 0) {
        return <p className="rounded-[14px] border border-white/[0.06] bg-[#090D12]/70 p-4 text-sm text-[#8A94A6]">Пока нет подходов. Добавь первый подход.</p>
    }

    return (
        <div className="space-y-2">
            {exercise.sets_completed.map((set) => {
                const isEditing = editingKey === set.set_number
                return (
                    <div key={set.set_number} className="rounded-[14px] border border-white/[0.06] bg-[#090D12]/70 px-3 py-2">
                        <div className="flex min-h-11 items-center gap-2">
                            <span className="w-8 shrink-0 text-sm font-bold text-[#8A94A6]">#{set.set_number}</span>
                            {isEditing ? (
                                <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.5"
                                        value={set.weight ?? 0}
                                        onChange={(event) => update(set, { weight: Number(event.target.value) })}
                                        className="min-h-11 rounded-xl bg-[#151C26] px-2 text-sm font-bold text-[#F8FAFC] outline-none"
                                        aria-label="Вес"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        value={set.reps ?? 0}
                                        onChange={(event) => update(set, { reps: Number.parseInt(event.target.value, 10) || 0 })}
                                        className="min-h-11 rounded-xl bg-[#151C26] px-2 text-sm font-bold text-[#F8FAFC] outline-none"
                                        aria-label="Повторы"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={set.rpe ?? 8}
                                        onChange={(event) => update(set, { rpe: Number.parseInt(event.target.value, 10) || 8 })}
                                        className="min-h-11 rounded-xl bg-[#151C26] px-2 text-sm font-bold text-[#F8FAFC] outline-none"
                                        aria-label="RPE"
                                    />
                                </div>
                            ) : (
                                <div className="grid min-w-0 flex-1 grid-cols-[1fr_0.8fr_auto] items-center gap-2 text-sm font-semibold text-[#F8FAFC]">
                                    <span>{formatKg(set.weight ?? 0)} кг</span>
                                    <span>x {set.reps ?? 0}</span>
                                    <span className="rounded-lg bg-[#22C55E]/15 px-2 py-1 text-xs font-extrabold text-[#4ADE80]">RPE {set.rpe ?? '—'}</span>
                                </div>
                            )}
                            {set.completed ? (
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#22C55E]/15 text-[#4ADE80]" aria-label="Подход выполнен">
                                    <CheckCircle2 className="h-5 w-5" />
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => complete(set)}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#22C55E] text-white shadow-[0_8px_22px_rgba(34,197,94,0.25)] active:scale-95"
                                    aria-label={`Отметить подход ${set.set_number} выполненным`}
                                    title="Готово"
                                >
                                    <Check className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setEditingKey(isEditing ? null : set.set_number)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#151C26] text-[#8A94A6]"
                                aria-label="Редактировать подход"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(set.set_number)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EF4444]/10 text-[#EF4444]"
                                aria-label="Удалить подход"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function ActiveExerciseCard({
    exercise,
    exerciseIndex,
    previousBest,
    recommendation,
    isWeightRecLoading,
    isWeightRecError,
    onUpdateSet,
    onPatchWorkout,
    onNotifySetCompleted,
    onAddExercise,
    onFinishExercise,
    onSetLastCompletedSet,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    previousBest?: CompletedSet
    recommendation?: WeightRecommendationResponse
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    onUpdateSet: UpdateSetFn
    onPatchWorkout: PatchItemFn
    onNotifySetCompleted: () => void
    onAddExercise: () => void
    onFinishExercise: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
}) {
    const last = getLastCompletedSet(exercise)
    const best = getBestSet(exercise, previousBest)
    const [menuOpen, setMenuOpen] = useState(false)
    const handleDeleteExercise = useCallback(() => {
        const shouldDelete = window.confirm('Удалить упражнение из тренировки?')
        if (!shouldDelete) return
        onPatchWorkout((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((_, index) => index !== exerciseIndex),
        }))
        onNotifySetCompleted()
        toast.info('Упражнение удалено')
    }, [exerciseIndex, onNotifySetCompleted, onPatchWorkout])

    return (
        <section className="rounded-[20px] border border-white/[0.08] bg-[#111821] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.3)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="line-clamp-2 text-xl font-extrabold leading-tight text-[#F8FAFC]">{exercise.name}</h2>
                    <div className="mt-3 grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-medium text-[#8A94A6]">Последний раз</p>
                            <p className="mt-1 text-base font-bold text-[#F8FAFC]">{formatSetResult(last)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[#8A94A6]">Лучший результат</p>
                            <p className="mt-1 text-base font-bold text-[#F8FAFC]">{best?.weight != null ? `${formatKg(best.weight)} кг` : '—'}</p>
                        </div>
                    </div>
                </div>
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((value) => !value)}
                        className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#151C26] text-[#F8FAFC] active:bg-white/10"
                        aria-label="Действия с упражнением"
                    >
                        <MoreHorizontal className="h-5 w-5" />
                    </button>
                    {menuOpen ? (
                        <div className="absolute right-0 top-12 z-10 w-56 overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#151C26] shadow-2xl">
                            <button type="button" className="block min-h-11 w-full px-4 text-left text-sm font-semibold text-[#F8FAFC]" onClick={onAddExercise}>
                                Заменить упражнение
                            </button>
                            <button type="button" className="block min-h-11 w-full px-4 text-left text-sm font-semibold text-[#F8FAFC]" onClick={onFinishExercise}>
                                Завершить упражнение
                            </button>
                            <button type="button" className="block min-h-11 w-full px-4 text-left text-sm font-semibold text-[#EF4444]" onClick={handleDeleteExercise}>
                                Удалить из тренировки
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-4">
                <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#8A94A6]">Подходы</h3>
                <SetsList
                    exercise={exercise}
                    exerciseIndex={exerciseIndex}
                    onUpdateSet={onUpdateSet}
                    onPatchWorkout={onPatchWorkout}
                    onNotifySetCompleted={onNotifySetCompleted}
                    onSetLastCompletedSet={onSetLastCompletedSet}
                />
            </div>

            <div className="mt-4">
                <WeightRecommendation
                    recommendation={recommendation}
                    isLoading={isWeightRecLoading}
                    isError={isWeightRecError}
                    lastRpe={last?.rpe}
                    fallbackWeight={recommendation?.suggested_weight ?? last?.weight}
                    fallbackReps={last?.reps}
                />
            </div>
        </section>
    )
}

function StepButton({ children, onClick }: { children: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="min-h-11 rounded-[14px] border border-white/[0.06] bg-[#151C26] px-3 text-sm font-extrabold text-[#4ADE80] active:bg-white/10"
        >
            {children}
        </button>
    )
}

function AddSetPanel({
    exercise,
    exerciseIndex,
    previousBest,
    isSaving,
    onPatchWorkout,
    onNotifySetCompleted,
    onSetLastCompletedSet,
}: {
    exercise: CompletedExercise
    exerciseIndex: number
    previousBest?: CompletedSet
    isSaving: boolean
    onPatchWorkout: PatchItemFn
    onNotifySetCompleted: () => void
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
}) {
    const startSessionRestTimer = useWorkoutSessionUiStore((s) => s.startSessionRestTimer)
    const [weight, setWeight] = useState(0)
    const [reps, setReps] = useState(8)
    const [rpe, setRpe] = useState(8)
    const disabled = reps <= 0 || weight < 0 || isSaving

    useEffect(() => {
        const last = getLastCompletedSet(exercise)
        const source = last ?? previousBest
        setWeight(source?.weight ?? 0)
        setReps(source?.reps ?? 8)
        setRpe(source?.rpe ?? 8)
    }, [exercise, exerciseIndex, previousBest])

    const adjustWeight = useCallback((delta: number) => {
        setWeight((value) => Math.max(0, Number((value + delta).toFixed(2))))
    }, [])

    const addSet = useCallback(() => {
        if (disabled) return
        const nextSetNumber = exercise.sets_completed.length + 1
        const nextSet: CompletedSet = {
            id: -Math.abs(Date.now()),
            set_number: nextSetNumber,
            weight,
            reps,
            rpe,
            completed: true,
            completed_at: new Date().toISOString(),
        }

        onPatchWorkout((prev) => ({
            ...prev,
            exercises: prev.exercises.map((item, index) => (
                index === exerciseIndex
                    ? { ...item, sets_completed: [...item.sets_completed, nextSet] }
                    : item
            )),
        }))
        onSetLastCompletedSet({ exerciseIndex, setNumber: nextSetNumber })
        onNotifySetCompleted()

        const restSeconds = getRestSeconds(exercise)
        startSessionRestTimer({
            forExerciseId: `${exercise.exercise_id}-${exerciseIndex}`,
            exerciseIndex,
            exerciseName: exercise.name,
            nextSetOrdinal: nextSetNumber + 1,
            totalSets: nextSetNumber + 1,
            total: restSeconds,
        })
    }, [
        disabled,
        exercise,
        exerciseIndex,
        onNotifySetCompleted,
        onPatchWorkout,
        onSetLastCompletedSet,
        reps,
        rpe,
        startSessionRestTimer,
        weight,
    ])

    return (
        <section className="rounded-[20px] border border-white/[0.08] bg-[#111821] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
            <h3 className="text-base font-extrabold uppercase tracking-wide text-[#8A94A6]">Дополнительный подход</h3>
            <p className="mt-1 text-sm font-medium text-[#8A94A6]">
                Используйте, если сделали подход сверх плана.
            </p>
            <div className="mt-4 space-y-4">
                <div>
                    <p className="mb-2 text-sm font-medium text-[#CBD5E1]">Вес (кг)</p>
                    <div className="grid grid-cols-[1fr_1fr_1.35fr_1fr_1fr] gap-2">
                        <StepButton onClick={() => adjustWeight(-5)}>-5</StepButton>
                        <StepButton onClick={() => adjustWeight(-2.5)}>-2.5</StepButton>
                        <div className="flex min-h-12 flex-col items-center justify-center rounded-[14px] px-2 text-3xl font-extrabold tabular-nums text-[#F8FAFC]">
                            {formatKg(weight)} кг
                        </div>
                        <StepButton onClick={() => adjustWeight(2.5)}>+2.5</StepButton>
                        <StepButton onClick={() => adjustWeight(5)}>+5</StepButton>
                    </div>
                </div>
                <div>
                    <p className="mb-2 text-sm font-medium text-[#CBD5E1]">Повторы</p>
                    <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-2">
                        <StepButton onClick={() => setReps((value) => Math.max(1, value - 1))}>-1</StepButton>
                        <div className="flex min-h-12 items-center justify-center rounded-[14px] px-2 text-3xl font-extrabold tabular-nums text-[#F8FAFC]">
                            {reps} <span className="ml-1 text-sm font-medium text-[#8A94A6]">повт.</span>
                        </div>
                        <StepButton onClick={() => setReps((value) => value + 1)}>+1</StepButton>
                    </div>
                </div>
                <div>
                    <p className="mb-2 text-sm font-medium text-[#CBD5E1]">RPE (тяжесть)</p>
                    <div className="grid grid-cols-5 gap-2">
                        {RPE_OPTIONS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setRpe(value)}
                                className={cn(
                                    'min-h-11 rounded-[14px] border text-sm font-extrabold',
                                    rpe === value
                                        ? 'border-[#4ADE80] bg-[#22C55E]/40 text-[#F8FAFC]'
                                        : 'border-white/[0.06] bg-[#151C26] text-[#CBD5E1] active:bg-white/10',
                                )}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>
                <Button type="button" className="min-h-[56px] w-full rounded-[14px] bg-[#22C55E] text-base font-extrabold text-white hover:bg-[#16A34A]" disabled={disabled} onClick={addSet}>
                    <Plus className="mr-1 h-5 w-5" />
                    Добавить дополнительный подход
                </Button>
            </div>
        </section>
    )
}

function RestTimerCard() {
    const timer = useWorkoutSessionUiStore((s) => s.sessionRestTimer)
    const tick = useWorkoutSessionUiStore((s) => s.tickSessionRestTimer)
    const skip = useWorkoutSessionUiStore((s) => s.skipSessionRestTimer)
    const start = useWorkoutSessionUiStore((s) => s.startSessionRestTimer)

    useEffect(() => {
        if (!timer?.active) return undefined
        const id = window.setInterval(tick, 1000)
        return () => window.clearInterval(id)
    }, [tick, timer?.active])

    useEffect(() => {
        if (timer && timer.remaining <= 0) {
            skip()
        }
    }, [skip, timer])

    if (!timer) return null
    const progress = timer.total > 0 ? Math.max(0, Math.min(100, (timer.remaining / timer.total) * 100)) : 0

    return (
        <section className="fixed bottom-[calc(var(--app-shell-nav-h)+5.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 mx-auto max-w-screen-sm rounded-[20px] border border-[#60A5FA]/25 bg-[#0D1B2E]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.36)] backdrop-blur">
            <div className="flex items-center justify-between gap-4">
                <div
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
                    style={{ background: `conic-gradient(#60A5FA ${progress}%, rgba(255,255,255,0.08) 0)` }}
                >
                    <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#0D1B2E] text-base font-extrabold tabular-nums text-[#F8FAFC]">
                        {formatTimer(timer.remaining)}
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold text-[#F8FAFC]">Отдых</p>
                    <p className="mt-1 line-clamp-1 text-sm text-[#CBD5E1]">
                        Следующий подход: #{timer.nextSetOrdinal}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={skip}
                            className="min-h-11 rounded-[14px] border border-[#60A5FA]/25 bg-[#17243A] px-3 text-sm font-bold text-[#F8FAFC]"
                        >
                            Skip
                        </button>
                        <button
                            type="button"
                            onClick={() => start({
                                forExerciseId: timer.forExerciseId,
                                exerciseIndex: timer.exerciseIndex,
                                exerciseName: timer.exerciseName,
                                nextSetOrdinal: timer.nextSetOrdinal,
                                totalSets: timer.totalSets,
                                total: timer.total,
                            })}
                            className="flex min-h-11 items-center gap-1 rounded-[14px] border border-[#60A5FA]/25 bg-[#17243A] px-3 text-sm font-bold text-[#F8FAFC]"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset
                        </button>
                </div>
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
                <Button type="button" variant="secondary" className="min-h-[54px] rounded-[14px] border-white/[0.08] bg-[#151C26] text-[#F8FAFC]" onClick={onAddExercise}>
                    <Plus className="mr-1 h-5 w-5" />
                    Упражнение
                </Button>
                <Button type="button" className="min-h-[54px] rounded-[14px] bg-[#22C55E] font-extrabold text-white hover:bg-[#16A34A]" onClick={onFinishWorkout} disabled={isSavingSet}>
                    <Check className="mr-1 h-5 w-5" />
                    Завершить
                </Button>
            </div>
        </div>
    )
}

export function ActiveWorkoutScreen({
    workout,
    workoutTitle,
    elapsedSeconds,
    currentExerciseIndex,
    previousBestByExercise,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    isSavingSet,
    onBack,
    onSelectExercise,
    onPatchWorkout,
    onUpdateSet,
    onNotifySetCompleted,
    onSetLastCompletedSet,
    onAddExercise,
    onFinishWorkout,
}: ActiveWorkoutScreenProps) {
    const [finishedExerciseIndexes, setFinishedExerciseIndexes] = useState<Set<number>>(() => new Set())
    const elapsedLabel = formatElapsedDuration(elapsedSeconds)
    const stats = useMemo(() => workoutStats(workout), [workout])
    const activeExercise = workout.exercises[currentExerciseIndex] ?? workout.exercises[0] ?? null
    const activeExerciseIndex = workout.exercises[currentExerciseIndex] ? currentExerciseIndex : 0
    const completedIndexes = useMemo(() => {
        const next = new Set(finishedExerciseIndexes)
        workout.exercises.forEach((exercise, index) => {
            if (exercise.sets_completed.length > 0 && exercise.sets_completed.every((set) => set.completed)) {
                next.add(index)
            }
        })
        return next
    }, [finishedExerciseIndexes, workout.exercises])

    const finishExercise = useCallback(() => {
        setFinishedExerciseIndexes((prev) => new Set(prev).add(activeExerciseIndex))
        const nextIndex = workout.exercises.findIndex((_, index) => index > activeExerciseIndex && !completedIndexes.has(index))
        if (nextIndex >= 0) {
            onSelectExercise(nextIndex)
            return
        }
        toast.info('Все упражнения завершены. Можно завершить тренировку.')
    }, [activeExerciseIndex, completedIndexes, onSelectExercise, workout.exercises])

    if (workout.exercises.length === 0) {
        return (
            <div className="min-h-full bg-[#090D12] p-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
                <WorkoutHeader title={workoutTitle} elapsedLabel={elapsedLabel} exerciseCount={0} onBack={onBack} />
                <div className="mt-6 rounded-[20px] border border-dashed border-white/[0.08] bg-[#111821] p-5 text-center">
                    <p className="text-sm text-[#8A94A6]">В тренировке пока нет упражнений</p>
                    <Button type="button" className="mt-4 w-full" onClick={onAddExercise}>
                        Добавить упражнение
                    </Button>
                </div>
                <WorkoutBottomBar isSavingSet={isSavingSet} onAddExercise={onAddExercise} onFinishWorkout={onFinishWorkout} />
            </div>
        )
    }

    return (
        <div className="min-h-full space-y-4 bg-[#090D12] p-4 pb-[calc(15rem+env(safe-area-inset-bottom,0px))]">
            <WorkoutHeader
                title={workoutTitle}
                elapsedLabel={elapsedLabel}
                exerciseCount={workout.exercises.length}
                onBack={onBack}
            />
            <LiveWorkoutStats elapsedLabel={elapsedLabel} totalSets={stats.totalSets} totalVolume={stats.totalVolume} />
            <ExerciseTabs
                exercises={workout.exercises}
                activeIndex={activeExerciseIndex}
                completedIndexes={completedIndexes}
                onSelect={onSelectExercise}
            />

            {activeExercise ? (
                <>
                    <ActiveExerciseCard
                        exercise={activeExercise}
                        exerciseIndex={activeExerciseIndex}
                        previousBest={previousBestByExercise.get(activeExercise.name)}
                        recommendation={weightRecommendation}
                        isWeightRecLoading={isWeightRecLoading}
                        isWeightRecError={isWeightRecError}
                        onUpdateSet={onUpdateSet}
                        onPatchWorkout={onPatchWorkout}
                        onNotifySetCompleted={onNotifySetCompleted}
                        onAddExercise={onAddExercise}
                        onFinishExercise={finishExercise}
                        onSetLastCompletedSet={onSetLastCompletedSet}
                    />
                    <AddSetPanel
                        exercise={activeExercise}
                        exerciseIndex={activeExerciseIndex}
                        previousBest={previousBestByExercise.get(activeExercise.name)}
                        isSaving={isSavingSet}
                        onPatchWorkout={onPatchWorkout}
                        onNotifySetCompleted={onNotifySetCompleted}
                        onSetLastCompletedSet={onSetLastCompletedSet}
                    />
                    <RestTimerCard />
                </>
            ) : null}

            <WorkoutBottomBar isSavingSet={isSavingSet} onAddExercise={onAddExercise} onFinishWorkout={onFinishWorkout} />
        </div>
    )
}
