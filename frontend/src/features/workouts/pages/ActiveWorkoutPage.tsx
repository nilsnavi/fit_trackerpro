import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { toast } from '@shared/stores/toastStore'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useSyncQueueWithRetry } from '@shared/hooks/useSyncQueueWithRetry'
import { useUnsavedChangesGuard } from '@shared/hooks/useUnsavedChangesGuard'
import { queryKeys } from '@shared/api/queryKeys'

import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'

import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useOptimisticWorkoutSession } from '@features/workouts/hooks/useOptimisticWorkoutSession'
import { useCompleteWorkoutMutation, useUpdateWorkoutSessionMutation } from '@features/workouts/hooks/useWorkoutMutations'
import type { WorkoutHistoryItem, WorkoutSessionUpdateRequest } from '@features/workouts/types/workouts'

import { useConflictResolution } from '@features/workouts/components/ConflictResolutionUI'
import { ActiveWorkoutHeader } from '@features/workouts/active/components/ActiveWorkoutHeader'
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
} from '@/state/local'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'

import { buildSyncPayload, formatElapsedDuration } from '@features/workouts/active/lib/activeWorkoutUtils'
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

import { ActiveWorkoutSummarySection } from '@features/workouts/active/containers/ActiveWorkoutSummarySection'
import { ActiveWorkoutExerciseSection } from '@features/workouts/active/containers/ActiveWorkoutExerciseSection'
import { ActiveWorkoutBottomActions } from '@features/workouts/active/containers/ActiveWorkoutBottomActions'
const ActiveWorkoutModals = lazy(() =>
    import('@features/workouts/active/containers/ActiveWorkoutModals').then((m) => ({ default: m.ActiveWorkoutModals })),
)

export function ActiveWorkoutPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const tg = useTelegramWebApp()
    const { isOnline, wasOffline } = useNetworkStatus()

    const workoutId: number = Number.parseInt(id ?? '', 10)
    const isValidWorkoutId: boolean = Number.isFinite(workoutId)
    const detailQueryKey = queryKeys.workouts.historyItem(workoutId)

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
    })

    const sendSessionPatch = useCallback(
        async (payload: WorkoutSessionUpdateRequest) => {
            await updateSessionMutation.mutateAsync({ workoutId, payload })
        },
        [updateSessionMutation, workoutId],
    )

    const { pushPendingSync, clearPendingSync, notifySetCompleted } = useWorkoutSync({
        enabled: Boolean(isActiveDraft && isValidWorkoutId),
        isOnline,
        flushWorkoutSync,
        sendSessionPatch,
    })

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

    const {
        data: weightRecommendation,
        isLoading: isWeightRecLoading,
        isError: isWeightRecError,
    } = useWeightRecommendation(
        workoutId,
        currentExercise?.exercise_id ?? 0,
        Boolean(isActiveDraft && currentExercise?.exercise_id && currentSet?.rpe != null),
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
            className={`p-4 space-y-4 ${isActiveDraft ? 'pb-[calc(15rem+env(safe-area-inset-bottom,0px))]' : ''}`}
        >
            {isActiveDraft && !isOnline ? <OfflineBanner variant="offline" /> : null}
            {isActiveDraft && isOnline && wasOffline ? <OfflineBanner variant="reconnecting" /> : null}

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

            <ActiveWorkoutHeader
                onBack={() => guardedAction(() => navigate('/workouts'))}
                syncState={syncState}
                pendingCount={syncPendingItems.length}
            />

            {isActiveDraft && workoutId && (
                <WorkoutSyncQueueStatus workoutId={workoutId} showDetails={false} />
            )}

            {isLoading && <div className="text-sm text-telegram-hint">Загрузка...</div>}
            {!isLoading && errorMessage && <div className="text-sm text-danger">{errorMessage}</div>}

            {!isLoading && !errorMessage && workout && (
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
            )}

            {isActiveDraft && !isLoading && !errorMessage && workout && (
                <>
                    <FloatingRestTimer />
                    <ActiveWorkoutBottomActions
                        isActiveDraft={isActiveDraft}
                        restPresets={restPresets}
                        restDefaultSeconds={restDefaultSeconds}
                        currentExercise={currentExercise}
                        isFinishing={completeMutation.isPending}
                        onSelectRestPreset={handleSelectRestPreset}
                        onAddItem={exerciseActions.resetAddItemForm}
                        onRemoveSet={exerciseActions.handleRemoveLastSetFromCurrentExercise}
                        onAddSet={exerciseActions.handleAddSetToCurrentExercise}
                        onFinishWorkout={completion.handleOpenFinishSheet}
                    />
                </>
            )}
        </div>
    )
}

