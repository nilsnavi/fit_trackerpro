import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { History, TrendingUp } from 'lucide-react'

import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { queryKeys } from '@shared/api/queryKeys'

import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useCompleteWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { useOptimisticWorkoutSession } from '@features/workouts/hooks/useOptimisticWorkoutSession'
import { useActiveWorkoutStats } from '@features/workouts/active/hooks/useActiveWorkoutStats'
import { useActiveWorkoutCompletion } from '@features/workouts/active/hooks/useActiveWorkoutCompletion'
import { FinishWorkoutModal } from '@features/workouts/active/modals/FinishWorkoutModal'
import { useActiveWorkoutStore } from '@/state/local'
import { useWorkoutSessionDraftStore } from '@/state/local'

import type { WorkoutSessionSummaryMetrics } from '@features/workouts/active/lib/workoutSessionSummaryMetrics'
import { formatDurationRu } from '@features/workouts/active/lib/workoutSessionSummaryMetrics'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'
import type { CompletedExercise, CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'

function formatShortDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}

function setVolume(set: CompletedSet): number {
    const weight = typeof set.weight === 'number' ? set.weight : 0
    const reps = typeof set.reps === 'number' ? set.reps : 0
    return weight * reps
}

function bestSetByVolume(exercise: CompletedExercise | undefined): CompletedSet | null {
    if (!exercise) return null
    return exercise.sets_completed
        .filter((set) => set.completed)
        .reduce<CompletedSet | null>((best, set) => {
            if (!best) return set
            return setVolume(set) > setVolume(best) ? set : best
        }, null)
}

function findPreviousExerciseBest(
    historyItems: WorkoutHistoryItem[] | undefined,
    currentWorkoutId: number,
    exercise: CompletedExercise,
): CompletedSet | null {
    const normalizedName = exercise.name.trim().toLowerCase()
    for (const item of historyItems ?? []) {
        if (item.id === currentWorkoutId || item.duration == null || item.duration <= 0) continue
        const match = item.exercises.find(
            (candidate) =>
                candidate.exercise_id === exercise.exercise_id ||
                candidate.name.trim().toLowerCase() === normalizedName,
        )
        const best = bestSetByVolume(match)
        if (best) return best
    }
    return null
}

/**
 * Экран итогов активной сессии перед финальным сохранением (данные из location.state).
 */
export function WorkoutSummaryPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()
    const tg = useTelegramWebApp()

    const workoutId = Number.parseInt(id ?? '', 10)
    const isValid = Number.isFinite(workoutId)

    const metrics = (location.state ?? null) as WorkoutSessionSummaryMetrics | null

    const {
        data: workout,
        isLoading,
        isError,
        error,
    } = useWorkoutHistoryItemQuery(workoutId, isValid)
    const { data: historyData } = useWorkoutHistoryQuery()

    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const abandonWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.abandonDraft)
    const clearActiveWorkoutDraft = useActiveWorkoutSessionDraftStore((s) => s.clearDraft)
    const resetActiveWorkoutState = useActiveWorkoutStore((s) => s.reset)
    const skipRestTimer = useActiveWorkoutStore((s) => s.skipRestTimer)

    const completeMutation = useCompleteWorkoutMutation()
    const detailQueryKey = queryKeys.workouts.historyItem(workoutId)

    const isActiveDraft = Boolean(
        workout && (workout.duration == null || workout.duration <= 0) && draftWorkoutId === workout.id,
    )

    const { updateSessionFields } = useOptimisticWorkoutSession(workoutId, isActiveDraft)
    const { completedExercises } = useActiveWorkoutStats({ workout })

    const noopFlush = useCallback(async () => {
        /* перед финалом синк уже выполнялся на экране сессии */
    }, [])

    const completion = useActiveWorkoutCompletion({
        workoutId,
        workout,
        isActiveDraft,
        queryClient,
        tg,
        navigate,
        completeMutation,
        flushWorkoutSync: noopFlush,
        clearActiveWorkoutDraft,
        skipRestTimer,
        resetActiveWorkoutState,
        abandonWorkoutSessionDraft,
        detailQueryKey,
        updateSessionFields: (patch) => updateSessionFields(patch as never),
    })
    const setCompletionDurationMinutes = completion.setDurationMinutes

    const [finishOpen, setFinishOpen] = useState(false)

    useEffect(() => {
        if (metrics?.totalDurationSeconds != null) {
            setCompletionDurationMinutes(Math.max(1, Math.round(metrics.totalDurationSeconds / 60)))
        }
    }, [metrics?.totalDurationSeconds, setCompletionDurationMinutes])

    const volumeLabel = useMemo(() => {
        const v = metrics?.totalVolumeKg ?? 0
        return `${Math.round(v * 10) / 10} кг`
    }, [metrics?.totalVolumeKg])

    const lastCompletedWorkout = useMemo(
        () =>
            (historyData?.items ?? []).find(
                (item) => item.id !== workoutId && typeof item.duration === 'number' && item.duration > 0,
            ) ?? null,
        [historyData?.items, workoutId],
    )

    const exerciseSummaryRows = useMemo(() => {
        if (!workout) return []
        return workout.exercises.map((exercise) => {
            const currentBest = bestSetByVolume(exercise)
            const previousBest = findPreviousExerciseBest(historyData?.items, workout.id, exercise)
            const currentVolume = currentBest ? setVolume(currentBest) : 0
            const previousVolume = previousBest ? setVolume(previousBest) : 0
            const delta = previousBest ? Math.round(currentVolume - previousVolume) : null
            return {
                id: `${exercise.exercise_id}-${exercise.name}`,
                name: exercise.name,
                completedSets: exercise.sets_completed.filter((set) => set.completed).length,
                currentBest,
                previousBest,
                delta,
            }
        })
    }, [historyData?.items, workout])

    if (!isValid) {
        return (
            <div className="p-4">
                <p className="text-sm text-danger">Неверный идентификатор тренировки</p>
                <Button type="button" className="mt-4" onClick={() => navigate('/workouts')}>
                    К тренировкам
                </Button>
            </div>
        )
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-telegram-hint">Загрузка…</div>
    }

    if (isError) {
        return (
            <div className="p-4">
                <p className="text-sm text-danger">{getErrorMessage(error)}</p>
            </div>
        )
    }

    if (!workout || (typeof workout.duration === 'number' && workout.duration > 0)) {
        return (
            <div className="p-4 space-y-3">
                <p className="text-sm text-telegram-hint">Сессия уже завершена или недоступна.</p>
                <Button type="button" onClick={() => navigate(`/workouts/${workout?.id ?? workoutId}`)}>
                    Открыть тренировку
                </Button>
            </div>
        )
    }

    if (!metrics) {
        return (
            <div className="p-4 space-y-3">
                <p className="text-sm text-telegram-hint">Нет данных предпросмотра. Вернитесь к активной тренировке.</p>
                <Button type="button" onClick={() => navigate(`/workouts/active/${workoutId}`)}>
                    Назад
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-4">
            <div>
                <h1 className="text-xl font-bold text-telegram-text">Итог тренировки</h1>
                <p className="mt-1 text-sm text-telegram-hint">Проверьте данные перед сохранением.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-4">
                    <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Длительность</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-telegram-text">{formatDurationRu(metrics.totalDurationSeconds)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-4">
                    <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Объём</p>
                    <p className="mt-1 text-lg font-semibold text-telegram-text">{volumeLabel}</p>
                </div>
                <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-4">
                    <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Подходы</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-telegram-text">{metrics.totalSetsCompleted}</p>
                </div>
                <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-4">
                    <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Упражнений</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-telegram-text">{metrics.exercisesCompleted}</p>
                </div>
            </div>

            <section className="rounded-2xl border border-border bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-telegram-text">История</h2>
                        <p className="mt-1 text-xs text-telegram-hint">
                            {lastCompletedWorkout
                                ? `${formatShortDate(lastCompletedWorkout.date)} · ${lastCompletedWorkout.duration} мин`
                                : 'Предыдущих завершённых тренировок пока нет'}
                        </p>
                    </div>
                    <History className="h-5 w-5 text-primary" />
                </div>
                <Button type="button" variant="secondary" className="w-full" onClick={() => navigate('/workouts/history')}>
                    Открыть историю
                </Button>
            </section>

            <section className="rounded-2xl border border-border bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-telegram-text">Прогресс упражнений</h2>
                        <p className="mt-1 text-xs text-telegram-hint">Лучший подход текущей сессии против прошлых записей.</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                    {exerciseSummaryRows.slice(0, 5).map((row) => (
                        <article key={row.id} className="rounded-xl bg-telegram-bg p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-telegram-text">{row.name}</p>
                                    <p className="mt-1 text-xs text-telegram-hint">{row.completedSets} выполнено</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                    {row.delta == null ? 'new' : row.delta >= 0 ? `+${row.delta}` : row.delta}
                                </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-lg bg-telegram-secondary-bg/70 px-3 py-2">
                                    <p className="text-telegram-hint">Сегодня</p>
                                    <p className="mt-1 font-semibold text-telegram-text">
                                        {row.currentBest?.weight ?? '—'} кг × {row.currentBest?.reps ?? '—'}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-telegram-secondary-bg/70 px-3 py-2">
                                    <p className="text-telegram-hint">Прошлый лучший</p>
                                    <p className="mt-1 font-semibold text-telegram-text">
                                        {row.previousBest?.weight ?? '—'} кг × {row.previousBest?.reps ?? '—'}
                                    </p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
                <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => navigate('/progress/exercises')}>
                    Открыть прогресс
                </Button>
            </section>

            <div className="flex flex-col gap-3">
                <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                        completion.setFinishTagsDraft((workout.tags ?? []).join(', '))
                        setFinishOpen(true)
                    }}
                >
                    Завершить тренировку
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => navigate(`/workouts/active/${workoutId}`)}>
                    Вернуться к сессии
                </Button>
            </div>

            {finishOpen ? (
                <FinishWorkoutModal
                    isOpen={finishOpen}
                    durationMinutes={completion.durationMinutes}
                    completedExercises={completedExercises}
                    comment={workout.comments ?? ''}
                    tagsDraft={completion.finishTagsDraft}
                    isPending={completeMutation.isPending}
                    errorMessage={completion.sessionError ?? (completeMutation.isError ? getErrorMessage(completeMutation.error) : null)}
                    syncState="idle"
                    isOnline
                    onRetryFinish={() => {
                        completeMutation.reset()
                        completion.handleConfirmFinishFromSheet()
                    }}
                    onSaveLocalFinish={completion.saveCompleteLocallyAndExit}
                    onClose={() => setFinishOpen(false)}
                    onConfirm={() => {
                        completion.handleConfirmFinishFromSheet()
                    }}
                    onChangeTagsDraft={completion.setFinishTagsDraft}
                />
            ) : null}
        </div>
    )
}
