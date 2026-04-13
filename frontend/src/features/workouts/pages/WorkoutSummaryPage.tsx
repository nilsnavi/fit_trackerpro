import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { queryKeys } from '@shared/api/queryKeys'

import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
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

    const [finishOpen, setFinishOpen] = useState(false)

    useEffect(() => {
        if (metrics?.totalDurationSeconds != null) {
            completion.setDurationMinutes(Math.max(1, Math.round(metrics.totalDurationSeconds / 60)))
        }
    }, [metrics?.totalDurationSeconds, completion.setDurationMinutes])

    const volumeLabel = useMemo(() => {
        const v = metrics?.totalVolumeKg ?? 0
        return `${Math.round(v * 10) / 10} кг`
    }, [metrics?.totalVolumeKg])

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
