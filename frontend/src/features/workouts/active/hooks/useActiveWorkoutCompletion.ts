import { useCallback, useEffect, useRef, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import type { UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp'
import { toast } from '@shared/stores/toastStore'
import { getErrorMessage } from '@shared/errors'
import { isOfflineMutationQueuedError } from '@shared/offline/syncQueue'
import { enqueueOfflineWorkoutComplete } from '@shared/offline/workoutOfflineEnqueue'
import { emitWorkoutSyncTelemetry } from '@shared/offline/observability/workoutSyncTelemetry'
import { queryKeys } from '@shared/api/queryKeys'
import {
    optimisticPatchHistoryItemComplete,
    patchCalendarWorkoutComplete,
    patchHistoryListItemComplete,
    restoreSnapshotEntries,
    takeWorkoutsCalendarSnapshot,
    takeWorkoutsHistoryListsSnapshot,
} from '@features/workouts/lib/workoutQueryOptimistic'
import type {
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'
import { parseTagsInput } from '../lib/activeWorkoutUtils'
import type { UseMutationResult } from '@tanstack/react-query'
import type { CompleteWorkoutVariables } from '@features/workouts/hooks/useWorkoutMutations'

type CompleteWorkoutMutation = UseMutationResult<
    WorkoutCompleteResponse,
    Error,
    CompleteWorkoutVariables,
    unknown
>

export interface UseActiveWorkoutCompletionParams {
    workoutId: number
    workout: WorkoutHistoryItem | undefined
    isActiveDraft: boolean
    queryClient: QueryClient
    tg: UseTelegramWebAppReturn
    navigate: NavigateFunction
    completeMutation: CompleteWorkoutMutation
    flushWorkoutSync: () => Promise<void>
    clearActiveWorkoutDraft: () => void
    skipRestTimer: () => void
    resetActiveWorkoutState: () => void
    abandonWorkoutSessionDraft: () => void
    detailQueryKey: readonly unknown[]
    updateSessionFields: (patch: Partial<WorkoutHistoryItem>) => void
}

export interface UseActiveWorkoutCompletionResult {
    durationMinutes: number
    setDurationMinutes: (value: number) => void
    sessionError: string | null
    setSessionError: (value: string | null) => void
    isFinishSheetOpen: boolean
    closeFinishSheet: () => void
    finishTagsDraft: string
    setFinishTagsDraft: (value: string) => void
    isAbandonConfirmOpen: boolean
    openAbandonConfirm: () => void
    closeAbandonConfirm: () => void
    handleConfirmAbandonDraft: () => void
    handleOpenFinishSheet: () => Promise<void>
    handleConfirmFinishFromSheet: () => void
    handleCompleteSession: (tagsOverride?: string[]) => void
    /** Принудительно в очередь офлайн и выход (после сетевых ошибок завершения) */
    saveCompleteLocallyAndExit: () => void
}

export function useActiveWorkoutCompletion({
    workoutId,
    workout,
    isActiveDraft,
    queryClient,
    tg,
    navigate,
    completeMutation,
    flushWorkoutSync,
    clearActiveWorkoutDraft,
    skipRestTimer,
    resetActiveWorkoutState,
    abandonWorkoutSessionDraft,
    detailQueryKey,
    updateSessionFields,
}: UseActiveWorkoutCompletionParams): UseActiveWorkoutCompletionResult {
    const [durationMinutes, setDurationMinutes] = useState<number>(45)
    const [sessionError, setSessionError] = useState<string | null>(null)
    const [isFinishSheetOpen, setIsFinishSheetOpen] = useState<boolean>(false)
    const closeFinishSheet = useCallback(() => {
        setIsFinishSheetOpen(false)
    }, [])

    const [finishTagsDraft, setFinishTagsDraft] = useState<string>('')
    const [isAbandonConfirmOpen, setIsAbandonConfirmOpen] = useState<boolean>(false)
    const isCompletingRef = useRef<boolean>(false)

    useEffect(() => {
        setSessionError(null)
        setDurationMinutes(45)
    }, [workoutId])

    const handleCompleteSession = useCallback((tagsOverride?: string[]) => {
        if (completeMutation.isPending || isCompletingRef.current) {
            return
        }

        setSessionError(null)
        const current = queryClient.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
        if (!current) {
            setSessionError('Нет данных тренировки')
            return
        }

        if (durationMinutes < 1 || durationMinutes > 1440) {
            setSessionError('Укажите длительность от 1 до 1440 минут')
            return
        }

        if (current.exercises.length === 0) {
            setSessionError('Добавьте упражнения (например, начните тренировку с сохранённого шаблона)')
            return
        }

        const hasCompletedSet = current.exercises.some((ex) => ex.sets_completed.some((set) => set.completed))
        if (!hasCompletedSet) {
            setSessionError('Отметьте хотя бы один выполненный подход')
            return
        }

        const payload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: current.exercises,
            comments: current.comments,
            tags: tagsOverride ?? current.tags ?? [],
            glucose_before: current.glucose_before,
            glucose_after: current.glucose_after,
        }

        isCompletingRef.current = true
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        completeMutation.mutate(
            { workoutId, payload },
            {
                onSuccess: (data) => {
                    setIsFinishSheetOpen(false)
                    clearActiveWorkoutDraft()
                    toast.success('Тренировка успешно завершена')
                    navigate(`/workouts/${data.id}`)
                },
                onError: (error) => {
                    if (isOfflineMutationQueuedError(error)) {
                        setIsFinishSheetOpen(false)
                        clearActiveWorkoutDraft()
                        toast.info('Тренировка будет синхронизирована при восстановлении сети')
                        navigate('/workouts', { replace: true })
                        return
                    }
                    const message = getErrorMessage(error)
                    setSessionError(message)
                    toast.error(message)
                },
                onSettled: () => {
                    isCompletingRef.current = false
                },
            },
        )
    }, [clearActiveWorkoutDraft, completeMutation, durationMinutes, navigate, queryClient, tg, workoutId])

    const handleOpenFinishSheet = useCallback(async () => {
        if (!isActiveDraft) return
        if (completeMutation.isPending || isCompletingRef.current) return
        if (!workout) return
        await flushWorkoutSync()
        setSessionError(null)
        setFinishTagsDraft((workout.tags ?? []).join(', '))
        setIsFinishSheetOpen(true)
    }, [completeMutation.isPending, flushWorkoutSync, isActiveDraft, workout])

    const handleConfirmFinishFromSheet = useCallback(() => {
        const parsedTags = parseTagsInput(finishTagsDraft)
        updateSessionFields({ tags: parsedTags })
        handleCompleteSession(parsedTags)
    }, [finishTagsDraft, handleCompleteSession, updateSessionFields])

    const saveCompleteLocallyAndExit = useCallback(() => {
        if (completeMutation.isPending || isCompletingRef.current) {
            return
        }

        setSessionError(null)
        const current = queryClient.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
        if (!current) {
            setSessionError('Нет данных тренировки')
            return
        }

        if (durationMinutes < 1 || durationMinutes > 1440) {
            setSessionError('Укажите длительность от 1 до 1440 минут')
            return
        }

        if (current.exercises.length === 0) {
            setSessionError('Добавьте упражнения (например, начните тренировку с сохранённого шаблона)')
            return
        }

        const hasCompletedSet = current.exercises.some((ex) => ex.sets_completed.some((set) => set.completed))
        if (!hasCompletedSet) {
            setSessionError('Отметьте хотя бы один выполненный подход')
            return
        }

        const parsedTags = parseTagsInput(finishTagsDraft)
        const payload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: current.exercises,
            comments: current.comments,
            tags: parsedTags.length > 0 ? parsedTags : current.tags ?? [],
            glucose_before: current.glucose_before,
            glucose_after: current.glucose_after,
        }

        const detailKey = queryKeys.workouts.historyItem(workoutId)
        const previousDetail = queryClient.getQueryData<WorkoutHistoryItem>(detailKey)

        void (async () => {
            await queryClient.cancelQueries({ queryKey: ['workouts'] })
            const calendarSnap = takeWorkoutsCalendarSnapshot(queryClient)
            const historyListsSnap = takeWorkoutsHistoryListsSnapshot(queryClient)
            try {
                if (previousDetail) {
                    queryClient.setQueryData(
                        detailKey,
                        optimisticPatchHistoryItemComplete(previousDetail, payload),
                    )
                    patchCalendarWorkoutComplete(
                        queryClient,
                        workoutId,
                        payload,
                        new Date().toISOString(),
                        previousDetail.date,
                    )
                }
                patchHistoryListItemComplete(queryClient, workoutId, payload)
                try {
                    emitWorkoutSyncTelemetry('workout_completed_offline', {
                        workout_id: workoutId,
                        channel: 'sync_queue',
                    })
                    enqueueOfflineWorkoutComplete(workoutId, payload)
                } catch (e) {
                    if (!isOfflineMutationQueuedError(e)) {
                        throw e
                    }
                }

                setIsFinishSheetOpen(false)
                clearActiveWorkoutDraft()
                skipRestTimer()
                resetActiveWorkoutState()
                abandonWorkoutSessionDraft()
                tg.hapticFeedback({ type: 'impact', style: 'medium' })
                toast.info('Тренировка будет синхронизирована при восстановлении сети')
                navigate('/workouts', { replace: true })
                void queryClient.invalidateQueries({ queryKey: ['workouts'] })
                void queryClient.invalidateQueries({ queryKey: ['analytics'] })
            } catch (e) {
                restoreSnapshotEntries(queryClient, calendarSnap)
                restoreSnapshotEntries(queryClient, historyListsSnap)
                if (previousDetail) {
                    queryClient.setQueryData(detailKey, previousDetail)
                }
                setSessionError(getErrorMessage(e))
                toast.error(getErrorMessage(e))
            }
        })()
    }, [
        abandonWorkoutSessionDraft,
        clearActiveWorkoutDraft,
        durationMinutes,
        finishTagsDraft,
        navigate,
        queryClient,
        resetActiveWorkoutState,
        skipRestTimer,
        tg,
        workoutId,
        completeMutation.isPending,
    ])

    const openAbandonConfirm = useCallback(() => {
        setSessionError(null)
        setIsAbandonConfirmOpen(true)
    }, [])

    const closeAbandonConfirm = useCallback(() => setIsAbandonConfirmOpen(false), [])

    const handleConfirmAbandonDraft = useCallback(() => {
        setIsAbandonConfirmOpen(false)
        setIsFinishSheetOpen(false)
        skipRestTimer()
        resetActiveWorkoutState()
        abandonWorkoutSessionDraft()
        clearActiveWorkoutDraft()
        queryClient.removeQueries({ queryKey: detailQueryKey, exact: true })
        void queryClient.invalidateQueries({ queryKey: ['workouts'] })
        toast.info('Тренировка отменена')
        navigate('/workouts', { replace: true })
    }, [
        abandonWorkoutSessionDraft,
        clearActiveWorkoutDraft,
        detailQueryKey,
        navigate,
        queryClient,
        resetActiveWorkoutState,
        skipRestTimer,
    ])

    return {
        durationMinutes,
        setDurationMinutes,
        sessionError,
        setSessionError,
        isFinishSheetOpen,
        closeFinishSheet,
        finishTagsDraft,
        setFinishTagsDraft,
        isAbandonConfirmOpen,
        openAbandonConfirm,
        closeAbandonConfirm,
        handleConfirmAbandonDraft,
        handleOpenFinishSheet,
        handleConfirmFinishFromSheet,
        handleCompleteSession,
        saveCompleteLocallyAndExit,
    }
}

