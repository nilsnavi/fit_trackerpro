import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Dumbbell } from 'lucide-react'

import { Button } from '@shared/ui/Button'
import { ActiveWorkoutSessionDetailsCollapsible } from '@features/workouts/active/components/ActiveWorkoutSessionDetailsCollapsible'
import { cn } from '@shared/lib/cn'
import { getErrorMessage } from '@shared/errors'
import { toast } from '@shared/stores/toastStore'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useSyncQueueWithRetry } from '@shared/hooks/useSyncQueueWithRetry'
import { useUnsavedChangesGuard } from '@shared/hooks/useUnsavedChangesGuard'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { flushQueue, getQueueSize } from '@shared/offline/offlineQueue'
import { isRecoverableSyncError } from '@shared/offline/syncQueue'

import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'

import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useOptimisticWorkoutSession } from '@features/workouts/hooks/useOptimisticWorkoutSession'
import { useCompleteWorkoutMutation, useUpdateWorkoutSessionMutation } from '@features/workouts/hooks/useWorkoutMutations'
import type { WorkoutHistoryItem, WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

import { useConflictResolution } from '@features/workouts/components/ConflictResolutionUI'
import { ActiveWorkoutHeader } from '@features/workouts/active/components/ActiveWorkoutHeader'
import { ActiveCurrentSetPanel } from '@features/workouts/active/components/ActiveCurrentSetPanel'
import { WorkoutSyncQueueStatus } from '@features/workouts/active/components/WorkoutSyncQueueStatus'
import { useActiveWorkoutSync } from '@features/workouts/active/hooks/useActiveWorkoutSync'
import { useActiveWorkoutDraftPersist } from '@features/workouts/active/hooks/useActiveWorkoutDraftPersist'
import { useWorkoutNavigation } from '@features/workouts/active/hooks/useWorkoutNavigation'
import { useWeightRecommendation } from '@features/workouts/active/hooks/useWeightRecommendation'

import {
    useActiveWorkoutActions,
    useActiveWorkoutStore,
    useWorkoutRestPresetsStore,
    useWorkoutSessionDraftStore,
    useWorkoutSessionUiStore,
} from '@/state/local'
import { isTreadmillExercise } from '@features/workouts/active/lib/treadmillExercise'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'

import { buildSyncPayload, formatElapsedDuration } from '@features/workouts/active/lib/activeWorkoutUtils'
import {
    clearWorkoutDraftFromLocalStorage,
    writeWorkoutDraftToLocalStorage,
} from '@features/workouts/active/lib/workoutDraftLocalStorage'
import { useActiveWorkoutLifecycle } from '@features/workouts/active/hooks/useActiveWorkoutLifecycle'
import { useActiveWorkoutCompletion } from '@features/workouts/active/hooks/useActiveWorkoutCompletion'
import { useActiveWorkoutExerciseActions } from '@features/workouts/active/hooks/useActiveWorkoutExerciseActions'
import { useActiveWorkoutRestFlow } from '@features/workouts/active/hooks/useActiveWorkoutRestFlow'
import { useActiveWorkoutStats } from '@features/workouts/active/hooks/useActiveWorkoutStats'
import { useActiveWorkoutHistoryInsights } from '@features/workouts/active/hooks/useActiveWorkoutHistoryInsights'
import { FloatingRestTimer } from '@features/workouts/active/components/FloatingRestTimer'
import { useActiveWorkoutCatalogSuggestions } from '@features/workouts/active/hooks/useActiveWorkoutCatalogSuggestions'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useWorkoutSync } from '@/hooks/useWorkoutSync'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

import { WorkoutConfirmModal } from '@features/workouts/components/WorkoutConfirmModal'
import { ActiveWorkoutSummarySection } from '@features/workouts/active/containers/ActiveWorkoutSummarySection'
import { ActiveWorkoutExerciseSection } from '@features/workouts/active/containers/ActiveWorkoutExerciseSection'
import { ActiveWorkoutBottomActions } from '@features/workouts/active/containers/ActiveWorkoutBottomActions'
import { WorkoutSessionScreenHeader } from '@features/workouts/active/components/WorkoutSessionScreenHeader'
import { WorkoutExerciseCard } from '@features/workouts/active/components/WorkoutExerciseCard'
import { ExerciseSessionBottomSheet } from '@features/workouts/active/components/ExerciseSessionBottomSheet'
import { WorkoutSessionRestOverlay } from '@features/workouts/active/components/WorkoutSessionRestOverlay'
import { countExercisesDone, deriveExerciseSessionState } from '@features/workouts/active/lib/exerciseSessionDerivation'
import { computeWorkoutSessionSummaryMetrics } from '@features/workouts/active/lib/workoutSessionSummaryMetrics'
const ActiveWorkoutModals = lazy(() =>
    import('@features/workouts/active/containers/ActiveWorkoutModals').then((m) => ({ default: m.ActiveWorkoutModals })),
)

/** Экран активной сессии (макет «WorkoutSessionScreen»). */
export function ActiveWorkoutPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const tg = useTelegramWebApp()
    const { isOnline } = useNetworkStatus()
    const [reconnectBanner, setReconnectBanner] = useState<'hidden' | 'syncing' | 'saved'>('hidden')
    const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
    const [finishSessionConfirmOpen, setFinishSessionConfirmOpen] = useState(false)
    const prevOnlineRef = useRef(isOnline)

    const modalExerciseIndex = useWorkoutSessionUiStore((s) => s.modalExerciseIndex)
    const openExerciseModal = useWorkoutSessionUiStore((s) => s.openExerciseModal)
    const closeExerciseModal = useWorkoutSessionUiStore((s) => s.closeExerciseModal)
    const startSessionRestTimer = useWorkoutSessionUiStore((s) => s.startSessionRestTimer)

    const workoutId: number = Number.parseInt(id ?? '', 10)
    const isValidWorkoutId: boolean = Number.isFinite(workoutId)
    const detailQueryKey = queryKeys.workouts.historyItem(workoutId)

    const getSessionPayload = useCallback((): WorkoutSessionUpdateRequest | null => {
        const w = queryClient.getQueryData<WorkoutHistoryItem>(detailQueryKey)
        if (!w) return null
        return buildSyncPayload(w)
    }, [queryClient, detailQueryKey])

    const refreshOfflineQueueRef = useRef<() => void>(() => { })

    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const clearWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.clearDraft)
    const abandonWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.abandonDraft)

    const initializeActiveWorkoutDraft = useActiveWorkoutSessionDraftStore((s) => s.initializeDraft)
    const clearActiveWorkoutDraft = useActiveWorkoutSessionDraftStore((s) => s.clearDraft)
    const getActiveWorkoutDraft = useActiveWorkoutSessionDraftStore((s) => s.getDraft)

    const activeExercises = useActiveWorkoutStore((s) => s.exercises)
    const currentExerciseIndex = useActiveWorkoutStore((s) => s.currentExerciseIndex)
    const currentSetIndex = useActiveWorkoutStore((s) => s.currentSetIndex)
    const elapsedSeconds = useActiveWorkoutStore((s) => s.elapsedSeconds)
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const restTimer = useActiveWorkoutStore((s) => s.restTimer)
    const startedAt = useActiveWorkoutStore((s) => s.startedAt)

    const {
        initializeSession: initializeActiveSession,
        setExercises: setActiveExercises,
        setElapsedSeconds: setActiveElapsedSeconds,
        setSyncState: setActiveSyncState,
        setCurrentPosition,
        startRestTimer,
        skipRestTimer,
        setRestDefaultSeconds,
        setLastCompletedSet,
        reset: resetActiveWorkoutState,
    } = useActiveWorkoutActions()

    const {
        data: workout,
        isFetching,
        isError,
        error: queryError,
    } = useWorkoutHistoryItemQuery(workoutId, isValidWorkoutId, {
        staleWhileEditing: draftWorkoutId === workoutId && isValidWorkoutId,
    })

    const isActiveDraft: boolean =
        workout != null &&
        draftWorkoutId === workout.id &&
        (workout.duration == null || workout.duration <= 0)

    const { isConfirmOpen: isLeaveConfirmOpen, guardedAction, onLeave, onStay } = useUnsavedChangesGuard({
        isDirty: isActiveDraft,
    })

    const { patchItem, updateSet, updateSessionFields } = useOptimisticWorkoutSession(workoutId, Boolean(isActiveDraft))

    const completeMutation = useCompleteWorkoutMutation()
    const updateSessionMutation = useUpdateWorkoutSessionMutation()

    const { data: profile } = useCurrentUserQuery()
    const draftStorageUserId = profile?.id ?? 'anon'
    const { data: historyData } = useWorkoutHistoryQuery()
    const { data: catalogExercises = [], isLoading: isCatalogLoading } = useExercisesCatalogQuery()

    const { pendingItems: syncPendingItems } = useSyncQueueWithRetry()
    const { conflict: conflictInfo, isOpen: isConflictOpen, closeConflict } = useConflictResolution()

    const restPresetScopeKey = useMemo(() => {
        const userKey = profile?.id != null ? String(profile.id) : 'anon'
        const templateKey = workout?.template_id != null ? String(workout.template_id) : 'default'
        return `${userKey}:${templateKey}`
    }, [profile?.id, workout?.template_id])

    const restPresets = useWorkoutRestPresetsStore((s) => s.getPresetsForScope(restPresetScopeKey))
    const scopedDefaultRest = useWorkoutRestPresetsStore((s) => s.getDefaultRestForScope(restPresetScopeKey))
    const setPresetsForScope = useWorkoutRestPresetsStore((s) => s.setPresetsForScope)
    const setDefaultRestForScope = useWorkoutRestPresetsStore((s) => s.setDefaultRestForScope)

    const {
        flushNow: flushWorkoutSync,
        syncState,
        pendingPayload,
        syncRetryExhausted,
        retrySessionSyncNow,
        dismissSessionSyncFailure,
    } = useActiveWorkoutSync({
        workoutId,
        draftStorageUserId,
        workout,
        draftWorkoutId,
        isActiveDraft,
        activeExercises,
        startedAt,
        queryClient,
        initializeActiveSession,
        setActiveExercises,
        setCurrentPosition,
        setActiveElapsedSeconds,
        setActiveSyncState,
        clearWorkoutSessionDraft,
        updateSessionMutation,
        buildSyncPayload,
        onBeforeOnlineSync: async () => {
            const pending = getQueueSize(workoutId)
            if (pending === 0) {
                refreshOfflineQueueRef.current()
                return
            }
            try {
                const { last, flushed } = await flushQueue(workoutsApi, { workoutId })
                if (last) {
                    queryClient.setQueryData(detailQueryKey, last)
                }
                if (flushed > 0) {
                    toast.success('Данные синхронизированы')
                    clearWorkoutDraftFromLocalStorage(draftStorageUserId, workoutId)
                }
            } finally {
                refreshOfflineQueueRef.current()
            }
        },
    })

    useEffect(() => {
        if (!isActiveDraft) {
            setReconnectBanner('hidden')
            prevOnlineRef.current = isOnline
            return undefined
        }

        const wasOnline = prevOnlineRef.current
        prevOnlineRef.current = isOnline

        if (wasOnline && !isOnline) {
            setReconnectBanner('hidden')
        }

        if (!wasOnline && isOnline) {
            setReconnectBanner('syncing')
            const toSaved = window.setTimeout(() => {
                setReconnectBanner('saved')
            }, 2000)
            const toHidden = window.setTimeout(() => {
                setReconnectBanner('hidden')
            }, 4000)
            return () => {
                window.clearTimeout(toSaved)
                window.clearTimeout(toHidden)
            }
        }

        return undefined
    }, [isOnline, isActiveDraft])

    const sendSessionPatch = useCallback(
        async (payload: WorkoutSessionUpdateRequest) => {
            try {
                await updateSessionMutation.mutateAsync({ workoutId, payload })
                clearWorkoutDraftFromLocalStorage(draftStorageUserId, workoutId)
            } catch (e) {
                if (isRecoverableSyncError(e)) {
                    writeWorkoutDraftToLocalStorage(draftStorageUserId, workoutId, payload)
                }
                throw e
            }
        },
        [draftStorageUserId, updateSessionMutation, workoutId],
    )

    const {
        pushPendingSync,
        clearPendingSync,
        notifySetCompleted,
        offlineSetQueueSize,
        refreshOfflineSetQueueSize,
    } = useWorkoutSync({
        enabled: Boolean(isActiveDraft && isValidWorkoutId),
        isOnline,
        workoutId,
        getSessionPayload,
        flushWorkoutSync,
        sendSessionPatch,
    })

    refreshOfflineQueueRef.current = refreshOfflineSetQueueSize

    const exhaustedPushRef = useRef<string | null>(null)
    useEffect(() => {
        if (!syncRetryExhausted || !pendingPayload) {
            return
        }
        const key = JSON.stringify(pendingPayload)
        if (exhaustedPushRef.current === key) {
            return
        }
        exhaustedPushRef.current = key
        pushPendingSync(pendingPayload)
    }, [syncRetryExhausted, pendingPayload, pushPendingSync])

    useEffect(() => {
        if (!syncRetryExhausted) {
            exhaustedPushRef.current = null
        }
    }, [syncRetryExhausted])

    const handleSaveSessionLocalFinish = useCallback(() => {
        dismissSessionSyncFailure()
        clearPendingSync()
        toast.info('Изменения сохранены локально')
    }, [clearPendingSync, dismissSessionSyncFailure])

    useActiveWorkoutDraftPersist(
        workout,
        isActiveDraft,
        elapsedSeconds,
        currentExerciseIndex,
        currentSetIndex,
        restDefaultSeconds,
    )

    const {
        currentExercise,
        currentSet,
        normalizedCurrentSetIndex,
        hasNextExercise,
        hasPrevExercise,
        goToNextSet,
        goToNextExercise,
        goToPreviousExercise,
    } = useWorkoutNavigation({
        activeExercises,
        currentExerciseIndex,
        currentSetIndex,
        setCurrentPosition,
        updateSet,
    })

    /**
     * Проверяем, есть ли предыдущий завершённый подход с RPE для текущего упражнения.
     * Recommendation показывается для текущего подхода, если предыдущий был завершён с RPE.
     */
    const hasPreviousSetWithRpe = useMemo(() => {
        if (!currentExercise || currentSetIndex === 0) return false
        const previousSet = currentExercise.sets_completed[currentSetIndex - 1]
        return previousSet?.rpe != null
    }, [currentExercise, currentSetIndex])

    const {
        data: weightRecommendation,
        isLoading: isWeightRecLoading,
        isError: isWeightRecError,
    } = useWeightRecommendation(
        workoutId,
        currentExercise?.exercise_id ?? 0,
        Boolean(isActiveDraft && currentExercise?.exercise_id && hasPreviousSetWithRpe && !currentSet?.completed),
    )

    useActiveWorkoutLifecycle({
        workoutId,
        workout,
        isActiveDraft,
        elapsedSeconds,
        currentExerciseIndex,
        currentSetIndex,
        restDefaultSeconds,
        tg,
        navigate,
        getActiveWorkoutDraft,
        initializeActiveWorkoutDraft,
        clearActiveWorkoutDraft,
        buildSyncPayload,
    })

    const errorMessage: string | null = !isValidWorkoutId
        ? 'Неверный идентификатор тренировки'
        : isError
            ? getErrorMessage(queryError)
            : null

    const isLoading: boolean = isValidWorkoutId && isFetching

    const { exerciseCount, completedSetCount, totalSetCount, completedExercises } = useActiveWorkoutStats({ workout })

    const { repeatSource, previousBestByExercise } = useActiveWorkoutHistoryInsights({
        workout,
        historyItems: historyData?.items,
    })

    const workoutTitle = useMemo(() => {
        const title = workout?.comments?.trim()
        return title && title.length > 0 ? title : `Сессия #${workout?.id ?? workoutId}`
    }, [workout?.comments, workout?.id, workoutId])

    const elapsedLabel = useMemo(() => formatElapsedDuration(elapsedSeconds), [elapsedSeconds])

    const exercisesDoneCount = useMemo(() => {
        if (!workout) return 0
        return countExercisesDone(workout.exercises, currentExerciseIndex, currentSetIndex)
    }, [workout, currentExerciseIndex, currentSetIndex])

    const allExercisesDone = exerciseCount > 0 && exercisesDoneCount >= exerciseCount
    const activeSessionProgressPercent = totalSetCount > 0 ? Math.round((completedSetCount / totalSetCount) * 100) : 0

    const completion = useActiveWorkoutCompletion({
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
        updateSessionFields: (patch) => updateSessionFields(patch as never),
    })

    const currentQueryWorkout = queryClient.getQueryData<WorkoutHistoryItem>(detailQueryKey) ?? null

    const exerciseActions = useActiveWorkoutExerciseActions({
        workout,
        isActiveDraft,
        queryWorkout: currentQueryWorkout,
        setSessionError: completion.setSessionError,
        patchItem,
        updateSet,
        setCurrentPosition,
        currentExerciseIndex,
        currentSetIndex,
        currentExercise,
        previousBestByExercise,
        repeatSource,
        tg,
    })

    const {
        isRestPresetsModalOpen,
        restPresetsDraft,
        openRestPresets,
        closeRestPresets,
        setRestPresetsDraft,
        handleSelectRestPreset,
        handleSaveRestPresets,
        handleToggleSetCompleted,
        handleStartQuickRest,
        previousBestLabelsByExercise,
    } = useActiveWorkoutRestFlow({
        workout,
        profileId: profile?.id,
        templateId: workout?.template_id ?? null,
        previousBestByExercise,
        restDefaultSeconds,
        restTimer,
        scopedDefaultRestSeconds: scopedDefaultRest,
        restPresets,
        setRestDefaultSeconds,
        setDefaultRestForScope,
        setPresetsForScope,
        startRestTimer,
        setCurrentPosition,
        updateSet,
        setLastCompletedSet,
        tg,
    })

    const {
        filteredCatalogExercises,
        favoriteCatalogExercises,
        recentCatalogExercises,
        suggestedCatalogExercises,
    } = useActiveWorkoutCatalogSuggestions({
        catalogExercises,
        historyItems: historyData?.items,
        workoutTitle: workout?.comments ?? '',
        filter: exerciseActions.exerciseCatalogFilter,
        query: exerciseActions.exerciseSearchQuery,
    })

    /**
     * PR UX note: before — «Готово» в строке подхода только ставил галочку; следующий подход выбирался отдельно.
     * after — как в карточке «Сейчас»: отметка + переход к следующему подходу (снять галочку — без перехода).
     */
    const handleToggleSetCompletedWithAdvance = useCallback(
        (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => {
            handleToggleSetCompleted(exerciseIndex, setNumber, nextCompleted)
            if (nextCompleted) {
                notifySetCompleted()
                goToNextSet()
            }
        },
        [goToNextSet, handleToggleSetCompleted, notifySetCompleted],
    )

    const handleSelectExerciseIndex = useCallback(
        (exerciseIndex: number) => {
            setCurrentPosition(exerciseIndex, 0)
        },
        [setCurrentPosition],
    )

    const handleSkipCurrentSetQuick = () => {
        if (!currentSet) return
        tg.hapticFeedback({ type: 'selection' })
        updateSet(currentExerciseIndex, currentSet.set_number, { completed: false })
        goToNextSet()
    }

    const handleCompleteCurrentSetQuick = useCallback(() => {
        if (!currentSet) return
        handleToggleSetCompletedWithAdvance(currentExerciseIndex, currentSet.set_number, true)
    }, [currentExerciseIndex, currentSet, handleToggleSetCompletedWithAdvance])

    const handleAddSetWithRest = useCallback(() => {
        exerciseActions.handleAddSetToCurrentExercise()
        startRestTimer(restDefaultSeconds)
        notifySetCompleted()
    }, [exerciseActions, notifySetCompleted, restDefaultSeconds, startRestTimer])

    const handleExerciseCardOpen = useCallback(
        (index: number) => {
            if (!workout) return
            const ex = workout.exercises[index]
            const st = deriveExerciseSessionState(ex, index, currentExerciseIndex, currentSetIndex)
            if (st.status === 'pending') {
                setCurrentPosition(index, 0)
            }
            openExerciseModal(index)
        },
        [workout, currentExerciseIndex, currentSetIndex, setCurrentPosition, openExerciseModal],
    )

    const handleNavigateToSummaryAfterConfirm = useCallback(() => {
        if (!workout) return
        void flushWorkoutSync().then(() => {
            const metrics = computeWorkoutSessionSummaryMetrics(
                workout,
                elapsedSeconds,
                currentExerciseIndex,
                currentSetIndex,
            )
            navigate(`/workouts/active/${workoutId}/summary`, { state: metrics })
            setFinishSessionConfirmOpen(false)
        })
    }, [workout, flushWorkoutSync, elapsedSeconds, currentExerciseIndex, currentSetIndex, navigate, workoutId])

    const handleModalUpdateRpe = useCallback(
        (exerciseIndex: number, setNumber: number, rpe: number) => {
            updateSet(exerciseIndex, setNumber, { rpe })
        },
        [updateSet],
    )

    const modalExercise = useMemo(() => {
        if (modalExerciseIndex == null || !workout) return null
        return workout.exercises[modalExerciseIndex] ?? null
    }, [modalExerciseIndex, workout])

    const modalSessionStatus = useMemo(() => {
        if (!modalExercise || modalExerciseIndex == null) return 'pending' as const
        return deriveExerciseSessionState(
            modalExercise,
            modalExerciseIndex,
            currentExerciseIndex,
            currentSetIndex,
        ).status
    }, [modalExercise, modalExerciseIndex, currentExerciseIndex, currentSetIndex])

    const modalNormalizedSetIndex =
        modalExerciseIndex != null && modalExerciseIndex === currentExerciseIndex ? normalizedCurrentSetIndex : 0

    const modalCatalogExercise = useMemo(() => {
        if (!modalExercise) return null
        return catalogExercises.find((e) => e.id === modalExercise.exercise_id) ?? null
    }, [modalExercise, catalogExercises])

    const isModalTreadmill = useMemo(
        () => (modalExercise ? isTreadmillExercise(modalExercise, modalCatalogExercise) : false),
        [modalExercise, modalCatalogExercise],
    )

    const handleRestTimerEnd = useCallback(
        (exerciseIndex: number) => {
            openExerciseModal(exerciseIndex)
        },
        [openExerciseModal],
    )

    const handleSheetComplete = useCallback(
        (opts: { restEnabled: boolean; restSeconds: number }) => {
            if (modalExerciseIndex == null || !workout || !modalExercise) return
            const exerciseIndex = modalExerciseIndex
            const currentSet = modalExercise.sets_completed[modalNormalizedSetIndex]
            if (!currentSet) return
            const isLastSet = modalNormalizedSetIndex >= modalExercise.sets_completed.length - 1

            handleToggleSetCompleted(exerciseIndex, currentSet.set_number, true, { skipAutoRestTimer: true })
            notifySetCompleted()

            if (isLastSet) {
                goToNextSet()
                closeExerciseModal()
                toast.success('Упражнение завершено')
                return
            }

            goToNextSet()

            if (opts.restEnabled) {
                closeExerciseModal()
                const { currentExerciseIndex: ci, currentSetIndex: csi } = useActiveWorkoutStore.getState()
                const ord = workout.exercises[ci]?.sets_completed[csi]?.set_number ?? 1
                startSessionRestTimer({
                    forExerciseId: `${modalExercise.exercise_id}-${exerciseIndex}`,
                    exerciseIndex,
                    exerciseName: modalExercise.name,
                    nextSetOrdinal: ord,
                    totalSets: modalExercise.sets_completed.length,
                    total: opts.restSeconds,
                })
            }
        },
        [
            modalExerciseIndex,
            workout,
            modalExercise,
            modalNormalizedSetIndex,
            handleToggleSetCompleted,
            notifySetCompleted,
            goToNextSet,
            closeExerciseModal,
            startSessionRestTimer,
        ],
    )

    const handleSheetSkip = useCallback(
        (opts: { restEnabled: boolean; restSeconds: number }) => {
            if (modalExerciseIndex == null || !workout || !modalExercise) return
            const exerciseIndex = modalExerciseIndex
            const currentSet = modalExercise.sets_completed[modalNormalizedSetIndex]
            if (!currentSet) return
            const isLastSet = modalNormalizedSetIndex >= modalExercise.sets_completed.length - 1

            tg.hapticFeedback({ type: 'selection' })
            setCurrentPosition(exerciseIndex, modalNormalizedSetIndex)
            updateSet(exerciseIndex, currentSet.set_number, { completed: false })

            if (isLastSet) {
                goToNextSet()
                closeExerciseModal()
                return
            }

            goToNextSet()

            if (opts.restEnabled) {
                closeExerciseModal()
                const { currentExerciseIndex: ci, currentSetIndex: csi } = useActiveWorkoutStore.getState()
                const ord = workout.exercises[ci]?.sets_completed[csi]?.set_number ?? 1
                startSessionRestTimer({
                    forExerciseId: `${modalExercise.exercise_id}-${exerciseIndex}`,
                    exerciseIndex,
                    exerciseName: modalExercise.name,
                    nextSetOrdinal: ord,
                    totalSets: modalExercise.sets_completed.length,
                    total: opts.restSeconds,
                })
            }
        },
        [
            modalExerciseIndex,
            workout,
            modalExercise,
            modalNormalizedSetIndex,
            tg,
            setCurrentPosition,
            updateSet,
            goToNextSet,
            closeExerciseModal,
            startSessionRestTimer,
        ],
    )

    const shouldLoadModals =
        isLeaveConfirmOpen ||
        completion.isFinishSheetOpen ||
        completion.isAbandonConfirmOpen ||
        exerciseActions.isDeleteExerciseConfirmOpen ||
        exerciseActions.addItemKind != null ||
        isRestPresetsModalOpen ||
        isConflictOpen

    if (!isLoading && !errorMessage && workout && !isActiveDraft) {
        return (
            <div className="p-4 space-y-4">
                <ActiveWorkoutHeader onBack={() => navigate('/workouts')} />

                <div className="rounded-xl border border-border bg-telegram-secondary-bg p-4 space-y-3">
                    <p className="text-sm text-telegram-hint">
                        Сессия уже завершена. Экран активной тренировки доступен только во время выполнения подходов.
                    </p>
                    <Button type="button" onClick={() => navigate(`/workouts/${workout.id}`)}>
                        Открыть детали тренировки
                    </Button>
                </div>
            </div>
        )
    }

    // PR UX: `pb-[calc(15rem+safe-area)]` — запас под раскрытый нижний rail, контент не упирается в панель.
    return (
        <div
            className={`min-h-full bg-telegram-bg p-4 space-y-4 ${isActiveDraft ? 'pb-[calc(15rem+env(safe-area-inset-bottom,0px))]' : ''}`}
        >
            {isActiveDraft && !isOnline ? (
                <OfflineBanner variant="offline" offlineSetCount={offlineSetQueueSize} />
            ) : null}
            {isActiveDraft && isOnline && reconnectBanner === 'syncing' ? (
                <OfflineBanner variant="online-syncing" />
            ) : null}
            {isActiveDraft && isOnline && reconnectBanner === 'saved' ? (
                <OfflineBanner variant="online-saved" />
            ) : null}

            {shouldLoadModals ? (
                <Suspense fallback={null}>
                    <ActiveWorkoutModals
                        isLeaveConfirmOpen={isLeaveConfirmOpen}
                        onLeave={onLeave}
                        onStay={onStay}
                        isFinishSheetOpen={completion.isFinishSheetOpen}
                        durationMinutes={completion.durationMinutes}
                        completedExercises={completedExercises}
                        comment={workout?.comments ?? ''}
                        tagsDraft={completion.finishTagsDraft}
                        isFinishPending={completeMutation.isPending}
                        finishErrorMessage={completion.sessionError ?? (completeMutation.isError ? getErrorMessage(completeMutation.error) : null)}
                        syncState={syncState}
                        isOnline={isOnline}
                        onRetryFinish={() => {
                            completeMutation.reset()
                            completion.handleConfirmFinishFromSheet()
                        }}
                        onSaveLocalFinish={() => {
                            completeMutation.reset()
                            completion.saveCompleteLocallyAndExit()
                        }}
                        onCloseFinish={completion.closeFinishSheet}
                        onConfirmFinish={completion.handleConfirmFinishFromSheet}
                        onChangeTagsDraft={completion.setFinishTagsDraft}
                        isAbandonConfirmOpen={completion.isAbandonConfirmOpen}
                        onCloseAbandon={completion.closeAbandonConfirm}
                        onConfirmAbandon={completion.handleConfirmAbandonDraft}
                        isDeleteExerciseConfirmOpen={exerciseActions.isDeleteExerciseConfirmOpen}
                        onCloseDeleteExercise={exerciseActions.closeDeleteExerciseConfirm}
                        onConfirmDeleteExercise={exerciseActions.handleConfirmDeleteExercise}
                        addItemKind={exerciseActions.addItemKind}
                        isCatalogLoading={isCatalogLoading}
                        catalogFilter={exerciseActions.exerciseCatalogFilter}
                        searchQuery={exerciseActions.exerciseSearchQuery}
                        selectedExercise={exerciseActions.selectedCatalogExercise}
                        filteredCatalogExercises={filteredCatalogExercises}
                        recentExercises={recentCatalogExercises}
                        favoriteExercises={favoriteCatalogExercises}
                        suggestedExercises={suggestedCatalogExercises}
                        sets={exerciseActions.addItemSets}
                        reps={exerciseActions.addItemReps}
                        weight={exerciseActions.addItemWeight}
                        duration={exerciseActions.addItemDuration}
                        notes={exerciseActions.addItemNotes}
                        onCloseAddItem={exerciseActions.closeAddItemModal}
                        onChangeFilter={exerciseActions.setExerciseCatalogFilter}
                        onChangeSearch={exerciseActions.setExerciseSearchQuery}
                        onSelectExercise={exerciseActions.setSelectedCatalogExercise}
                        onChangeSets={exerciseActions.setAddItemSets}
                        onChangeReps={exerciseActions.setAddItemReps}
                        onChangeWeight={exerciseActions.setAddItemWeight}
                        onChangeDuration={exerciseActions.setAddItemDuration}
                        onChangeNotes={exerciseActions.setAddItemNotes}
                        onSubmitCreateItem={exerciseActions.handleCreateItem}
                        addTimerName={exerciseActions.addItemName}
                        onChangeTimerName={exerciseActions.setAddItemName}
                        isRestPresetsModalOpen={isRestPresetsModalOpen}
                        restPresetsDraft={restPresetsDraft}
                        onCloseRestPresets={closeRestPresets}
                        onChangeRestPresetsDraft={setRestPresetsDraft}
                        onSaveRestPresets={handleSaveRestPresets}
                        isConflictOpen={isConflictOpen}
                        conflictInfo={conflictInfo}
                        onResolveConflict={(strategy) => {
                            if (strategy === 'local') {
                                toast.success('Ваши изменения сохранены')
                            } else {
                                void queryClient.invalidateQueries({ queryKey: detailQueryKey })
                                toast.info('Данные обновлены с сервера')
                            }
                            closeConflict()
                        }}
                        onCancelConflict={closeConflict}
                    />
                </Suspense>
            ) : null}

            {isActiveDraft && workout ? (
                <WorkoutSessionScreenHeader
                    title={workoutTitle}
                    onBack={() => guardedAction(() => navigate('/workouts'))}
                    syncState={syncState}
                    pendingCount={syncPendingItems.length}
                    menuOpen={sessionMenuOpen}
                    onMenuToggle={() => setSessionMenuOpen((v) => !v)}
                    menuContent={(
                        <div className="py-1">
                            {repeatSource ? (
                                <button
                                    type="button"
                                    className="block w-full px-4 py-3 text-left text-sm text-telegram-text hover:bg-telegram-secondary-bg"
                                    onClick={() => {
                                        exerciseActions.handleRepeatPrevious()
                                        setSessionMenuOpen(false)
                                    }}
                                >
                                    Повторить прошлую
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="block w-full px-4 py-3 text-left text-sm text-telegram-text hover:bg-telegram-secondary-bg"
                                onClick={() => {
                                    exerciseActions.resetAddItemForm('exercise')
                                    setSessionMenuOpen(false)
                                }}
                            >
                                Добавить упражнение
                            </button>
                            <button
                                type="button"
                                className="block w-full px-4 py-3 text-left text-sm text-telegram-text hover:bg-telegram-secondary-bg"
                                onClick={() => {
                                    exerciseActions.resetAddItemForm('timer')
                                    setSessionMenuOpen(false)
                                }}
                            >
                                Добавить таймер
                            </button>
                            <button
                                type="button"
                                className="block w-full px-4 py-3 text-left text-sm text-telegram-text hover:bg-telegram-secondary-bg"
                                onClick={() => {
                                    openRestPresets()
                                    setSessionMenuOpen(false)
                                }}
                            >
                                Пресеты отдыха
                            </button>
                            <button
                                type="button"
                                className="block w-full px-4 py-3 text-left text-sm text-danger hover:bg-danger/10"
                                onClick={() => {
                                    completion.openAbandonConfirm()
                                    setSessionMenuOpen(false)
                                }}
                            >
                                Отменить тренировку
                            </button>
                        </div>
                    )}
                />
            ) : (
                <ActiveWorkoutHeader
                    onBack={() => guardedAction(() => navigate('/workouts'))}
                    syncState={syncState}
                    pendingCount={syncPendingItems.length}
                />
            )}

            {isActiveDraft && workoutId && (
                <WorkoutSyncQueueStatus workoutId={workoutId} showDetails={false} />
            )}

            {isLoading && <div className="text-sm text-telegram-hint">Загрузка...</div>}
            {!isLoading && errorMessage && <div className="text-sm text-danger">{errorMessage}</div>}

            {!isLoading && !errorMessage && workout && isActiveDraft ? (
                <>
                    <div className="rounded-2xl border border-border bg-telegram-secondary-bg/80 p-3 shadow-sm">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-telegram-bg/80 p-3">
                                <Dumbbell className="h-4 w-4 text-primary" />
                                <p className="mt-2 text-lg font-bold tabular-nums text-telegram-text">{exerciseCount}</p>
                                <p className="text-[11px] leading-tight text-telegram-hint">упражнений</p>
                            </div>
                            <div className="rounded-xl bg-telegram-bg/80 p-3">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <p className="mt-2 text-lg font-bold tabular-nums text-telegram-text">{exercisesDoneCount}</p>
                                <p className="text-[11px] leading-tight text-telegram-hint">выполнено</p>
                            </div>
                            <div className="rounded-xl bg-telegram-bg/80 p-3">
                                <Clock3 className="h-4 w-4 text-primary" />
                                <p className="mt-2 text-lg font-bold tabular-nums text-telegram-text">{elapsedLabel}</p>
                                <p className="text-[11px] leading-tight text-telegram-hint">время</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="font-medium text-telegram-hint">Общий прогресс</span>
                            <span className="font-semibold text-telegram-text">
                                {completedSetCount}/{totalSetCount} подходов
                            </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-telegram-bg">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, activeSessionProgressPercent))}%` }}
                            />
                        </div>
                    </div>

                    <ActiveCurrentSetPanel
                        exercise={currentExercise}
                        set={currentSet}
                        exerciseIndex={currentExerciseIndex}
                        setIndex={normalizedCurrentSetIndex}
                        exerciseCount={exerciseCount}
                        completedSetCount={completedSetCount}
                        totalSetCount={totalSetCount}
                        elapsedLabel={elapsedLabel}
                        restDefaultSeconds={restDefaultSeconds}
                        hasPrevExercise={hasPrevExercise}
                        hasNextExercise={hasNextExercise}
                        weightRecommendation={weightRecommendation}
                        isWeightRecLoading={isWeightRecLoading}
                        isWeightRecError={isWeightRecError}
                        onUpdateSet={updateSet}
                        onCompleteSet={handleCompleteCurrentSetQuick}
                        onSkipSet={handleSkipCurrentSetQuick}
                        onAddSet={handleAddSetWithRest}
                        onStartRest={handleStartQuickRest}
                        onGoToPreviousExercise={goToPreviousExercise}
                        onGoToNextExercise={goToNextExercise}
                    />

                    <Button
                        type="button"
                        variant="secondary"
                        data-testid="finish-workout-btn"
                        className={cn(
                            'w-full touch-manipulation border-2',
                            allExercisesDone && 'border-danger/50 text-danger hover:bg-danger/10',
                        )}
                        onClick={() => setFinishSessionConfirmOpen(true)}
                        disabled={completeMutation.isPending}
                    >
                        Завершить тренировку
                    </Button>

                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-telegram-hint">План тренировки</p>
                        <span className="text-xs font-medium text-telegram-hint">
                            {currentExerciseIndex + 1}/{exerciseCount}
                        </span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {workout.exercises.map((exercise, index) => (
                            <WorkoutExerciseCard
                                key={`${exercise.exercise_id}-${index}`}
                                exercise={exercise}
                                exerciseIndex={index}
                                currentExerciseIndex={currentExerciseIndex}
                                currentSetIndex={currentSetIndex}
                                onOpen={() => handleExerciseCardOpen(index)}
                            />
                        ))}
                    </div>

                    <div className="rounded-2xl border border-warning/35 bg-warning/10 p-3 space-y-2">
                        <p className="text-sm leading-relaxed text-telegram-text">
                            Черновик сохраняется автоматически до завершения сессии.
                        </p>
                    </div>

                    {completion.sessionError ? <p className="text-sm text-danger">{completion.sessionError}</p> : null}
                    {completeMutation.isError ? (
                        <p className="text-sm text-danger">{getErrorMessage(completeMutation.error)}</p>
                    ) : null}
                    {updateSessionMutation.isError ? (
                        <p className="text-sm text-danger">{getErrorMessage(updateSessionMutation.error)}</p>
                    ) : null}

                    {syncState === 'error' || syncRetryExhausted ? (
                        <div className="flex flex-col gap-2 rounded-lg border border-danger/25 bg-danger/5 p-3 sm:flex-row sm:flex-wrap">
                            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={retrySessionSyncNow}>
                                Повторить
                            </Button>
                            {syncRetryExhausted ? (
                                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={handleSaveSessionLocalFinish}>
                                    Сохранить локально и завершить
                                </Button>
                            ) : null}
                        </div>
                    ) : null}

                    <ActiveWorkoutSessionDetailsCollapsible
                        workout={workout}
                        workoutTitle={workoutTitle}
                        elapsedLabel={elapsedLabel}
                        isActiveDraft={isActiveDraft}
                        durationMinutes={completion.durationMinutes}
                        exerciseCount={exerciseCount}
                        completedSetCount={completedSetCount}
                        onDurationChange={completion.setDurationMinutes}
                        onCommentsChange={(value) => updateSessionFields({ comments: value || undefined })}
                        onOpenRestPresets={openRestPresets}
                    />

                    {modalExercise && modalExerciseIndex != null ? (
                        <ExerciseSessionBottomSheet
                            isOpen
                            onClose={closeExerciseModal}
                            exercise={modalExercise}
                            exerciseIndex={modalExerciseIndex}
                            readOnly={modalSessionStatus === 'done'}
                            sessionStatus={modalSessionStatus}
                            currentExerciseIndex={currentExerciseIndex}
                            currentSetIndex={currentSetIndex}
                            normalizedCurrentSetIndex={modalNormalizedSetIndex}
                            isTreadmill={isModalTreadmill}
                            defaultRestSeconds={restDefaultSeconds}
                            onUpdateSet={updateSet}
                            onFocusPosition={setCurrentPosition}
                            onCompleteSet={handleSheetComplete}
                            onSkipSet={handleSheetSkip}
                            onUpdateSetRpe={handleModalUpdateRpe}
                            weightRecommendation={modalExerciseIndex === currentExerciseIndex ? weightRecommendation : undefined}
                            isWeightRecLoading={modalExerciseIndex === currentExerciseIndex ? isWeightRecLoading : false}
                            isWeightRecError={modalExerciseIndex === currentExerciseIndex ? isWeightRecError : false}
                        />
                    ) : null}

                    <WorkoutConfirmModal
                        isOpen={finishSessionConfirmOpen}
                        title="Завершить тренировку?"
                        description={`Выполнено ${exercisesDoneCount} из ${exerciseCount} упражнений`}
                        confirmLabel="Завершить"
                        cancelLabel="Продолжить"
                        confirmVariant="emergency"
                        onClose={() => setFinishSessionConfirmOpen(false)}
                        onConfirm={handleNavigateToSummaryAfterConfirm}
                    />
                </>
            ) : null}

            {!isLoading && !errorMessage && workout && !isActiveDraft ? (
                <>
                    <ActiveWorkoutSummarySection
                        workout={workout}
                        workoutTitle={workoutTitle}
                        elapsedLabel={elapsedLabel}
                        isActiveDraft={isActiveDraft}
                        durationMinutes={completion.durationMinutes}
                        exerciseCount={exerciseCount}
                        completedSetCount={completedSetCount}
                        totalSetCount={totalSetCount}
                        sessionError={completion.sessionError}
                        completeError={completeMutation.isError ? completeMutation.error : null}
                        updateSessionError={updateSessionMutation.isError ? updateSessionMutation.error : null}
                        syncState={syncState}
                        syncRetryExhausted={syncRetryExhausted}
                        onRetrySessionSync={retrySessionSyncNow}
                        onSaveSessionLocalFinish={handleSaveSessionLocalFinish}
                        repeatButton={repeatSource ? (
                            <Button type="button" variant="secondary" size="sm" onClick={exerciseActions.handleRepeatPrevious}>
                                Повторить прошлую
                            </Button>
                        ) : null}
                        onDurationChange={completion.setDurationMinutes}
                        onCommentsChange={(value) => updateSessionFields({ comments: value || undefined })}
                        onAbandonDraft={completion.openAbandonConfirm}
                        restDefaultSeconds={restDefaultSeconds}
                        onStartRest={handleStartQuickRest}
                        onOpenRestPresets={openRestPresets}
                    />

                    <ActiveWorkoutExerciseSection
                        incrementScopePrefix={restPresetScopeKey}
                        exercises={workout.exercises}
                        currentExerciseIndex={currentExerciseIndex}
                        currentSetIndex={currentSetIndex}
                        previousBestLabelsByExercise={previousBestLabelsByExercise}
                        canReorder={isActiveDraft}
                        onDragEnd={exerciseActions.handleDragEnd}
                        onAddSet={exerciseActions.handleAddSetToCurrentExercise}
                        onRemoveSet={exerciseActions.handleRemoveLastSetFromCurrentExercise}
                        onDeleteExercise={exerciseActions.handleDeleteExerciseRequest}
                        onSetCurrentPosition={setCurrentPosition}
                        onToggleSetCompleted={handleToggleSetCompletedWithAdvance}
                        onSkipSet={handleSkipCurrentSetQuick}
                        onCopyPreviousSet={exerciseActions.handleCopyPreviousSet}
                        onAdjustWeight={exerciseActions.handleAdjustWeight}
                        onUpdateSet={updateSet}
                        onNotesChange={exerciseActions.handleExerciseNotesChange}
                        weightRecommendation={weightRecommendation}
                        isWeightRecLoading={isWeightRecLoading}
                        isWeightRecError={isWeightRecError}
                        hasNextExercise={hasNextExercise}
                        hasPrevExercise={hasPrevExercise}
                        onGoToNextExercise={goToNextExercise}
                        onGoToPreviousExercise={goToPreviousExercise}
                        onSelectExerciseIndex={handleSelectExerciseIndex}
                    />
                </>
            ) : null}

            {isActiveDraft && !isLoading && !errorMessage && workout && (
                <>
                    <WorkoutSessionRestOverlay onTimerEnd={handleRestTimerEnd} />
                    <FloatingRestTimer workout={workout} onUpdateSet={updateSet} />
                    <ActiveWorkoutBottomActions
                        isActiveDraft={isActiveDraft}
                        restPresets={restPresets}
                        restDefaultSeconds={restDefaultSeconds}
                        currentExercise={currentExercise}
                        isFinishing={completeMutation.isPending}
                        onSelectRestPreset={handleSelectRestPreset}
                        onAddItem={exerciseActions.resetAddItemForm}
                        onRemoveSet={exerciseActions.handleRemoveLastSetFromCurrentExercise}
                        onAddSet={handleAddSetWithRest}
                        onFinishWorkout={completion.handleOpenFinishSheet}
                        hideFinishButton
                    />
                </>
            )}
        </div>
    )
}

export { ActiveWorkoutPage as WorkoutSessionScreen }

