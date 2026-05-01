import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { offlineListQueryDefaults } from '@shared/offline/offlineQueryPersist'
import type {
    WorkoutCompleteRequest,
    WorkoutStartRequest,
    WorkoutSessionUpdateRequest,
    WorkoutTemplateCloneRequest,
    WorkoutTemplateCreateRequest,
    WorkoutTemplateCreateFromWorkoutRequest,
    WorkoutHistoryItem,
    WorkoutTemplateListResponse,
    WorkoutSetPatchRequest,
} from '@features/workouts/types/workouts'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { trackBusinessMetric } from '@shared/lib/businessMetrics'
import { getErrorMessage } from '@shared/errors'
import { toast } from '@shared/stores/toastStore'
import { isOfflineMutationQueuedError, isRecoverableSyncError } from '@shared/offline/syncQueue'
import {
    enqueueOfflineTemplateCreate,
    enqueueOfflineTemplateUpdate,
    enqueueOfflineWorkoutComplete,
    enqueueOfflineWorkoutSessionUpdate,
    enqueueOfflineWorkoutStart,
} from '@shared/offline/workoutOfflineEnqueue'
import { emitWorkoutSyncTelemetry } from '@shared/offline/observability/workoutSyncTelemetry'
import { withWorkoutNetworkRetries } from '@shared/lib/withWorkoutNetworkRetries'
import {
    appendCalendarWorkoutForMatchingMonth,
    buildCalendarEntryFromStartPayload,
    calendarEntryFromStartResponse,
    completedExercisesFromTemplate,
    findTemplateInCaches,
    historyItemFromCompleteResponse,
    historyItemFromStartResponse,
    nextOptimisticNegativeId,
    optimisticHistoryItemForStart,
    optimisticPatchHistoryItemComplete,
    optimisticTemplateRow,
    patchCalendarWorkoutComplete,
    patchHistoryListItemComplete,
    prependHistoryListItem,
    prependTemplateToMatchingLists,
    replaceCalendarWorkoutId,
    replaceHistoryListTemporalId,
    replaceTemplateIdInLists,
    replaceTemplateInListsById,
    restoreSnapshotEntries,
    takeWorkoutsCalendarSnapshot,
    takeWorkoutsHistoryListsSnapshot,
    takeWorkoutsTemplateListsSnapshot,
} from '@features/workouts/lib/workoutQueryOptimistic'

export type CompleteWorkoutVariables = {
    workoutId: number
    payload: WorkoutCompleteRequest
}

export type UpdateWorkoutSessionVariables = {
    workoutId: number
    payload: WorkoutSessionUpdateRequest
}

type StartMutationContext = {
    tempId: number
    calendarSnap: ReturnType<typeof takeWorkoutsCalendarSnapshot>
    historyListsSnap: ReturnType<typeof takeWorkoutsHistoryListsSnapshot>
}

type CreateTemplateContext = {
    tempId: number
    templateListsSnap: ReturnType<typeof takeWorkoutsTemplateListsSnapshot>
}

type CloneTemplateVariables = {
    templateId: number
    payload?: WorkoutTemplateCloneRequest
}

type UpdateTemplateVariables = {
    templateId: number
    payload: WorkoutTemplateCreateRequest
}

type UpdateTemplateContext = {
    templateListsSnap: ReturnType<typeof takeWorkoutsTemplateListsSnapshot>
}

type DeleteTemplateContext = {
    templateListsSnap: ReturnType<typeof takeWorkoutsTemplateListsSnapshot>
}

type ArchiveTemplateContext = {
    templateListsSnap: ReturnType<typeof takeWorkoutsTemplateListsSnapshot>
}

type UnarchiveTemplateContext = {
    templateListsSnap: ReturnType<typeof takeWorkoutsTemplateListsSnapshot>
}

type CompleteMutationContext = {
    calendarSnap: ReturnType<typeof takeWorkoutsCalendarSnapshot>
    historyListsSnap: ReturnType<typeof takeWorkoutsHistoryListsSnapshot>
    previousDetail: WorkoutHistoryItem | undefined
    detailKey: readonly unknown[]
}

const WORKOUTS_ROOT = ['workouts'] as const

function invalidateWorkouts(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ queryKey: WORKOUTS_ROOT })
}

export function useCreateWorkoutTemplateMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (payload: WorkoutTemplateCreateRequest) => {
            try {
                return await workoutsApi.createTemplate(payload)
            } catch (e) {
                if (isRecoverableSyncError(e)) {
                    enqueueOfflineTemplateCreate(payload)
                }
                throw e
            }
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const tempId = nextOptimisticNegativeId()
            const templateListsSnap = takeWorkoutsTemplateListsSnapshot(queryClient)
            const row = optimisticTemplateRow(tempId, payload)
            prependTemplateToMatchingLists(queryClient, row, payload)
            return { tempId, templateListsSnap } satisfies CreateTemplateContext
        },
        onError: (err, _payload, ctx) => {
            if (isOfflineMutationQueuedError(err)) return
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.templateListsSnap)
        },
        onSuccess: (data, _payload, ctx) => {
            if (ctx) {
                replaceTemplateIdInLists(queryClient, ctx.tempId, data)
            }
            trackBusinessMetric('created_template', {
                template_id: data.id,
                exercise_count: data.exercises.length,
                type: data.type,
            })
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useUpdateWorkoutTemplateMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ templateId, payload }: UpdateTemplateVariables) => {
            try {
                return await workoutsApi.updateTemplate(templateId, payload)
            } catch (e) {
                if (isRecoverableSyncError(e)) {
                    enqueueOfflineTemplateUpdate(templateId, payload)
                }
                throw e
            }
        },
        onMutate: async ({ templateId, payload }) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const prev = findTemplateInCaches(queryClient, templateId)
            const templateListsSnap = takeWorkoutsTemplateListsSnapshot(queryClient)
            if (prev) {
                const optimisticRow = {
                    ...prev,
                    name: payload.name,
                    type: payload.type,
                    exercises: payload.exercises,
                    is_public: payload.is_public,
                    updated_at: new Date().toISOString(),
                }
                replaceTemplateInListsById(queryClient, templateId, optimisticRow)
            }
            return { templateListsSnap } satisfies UpdateTemplateContext
        },
        onError: (err, _vars, ctx) => {
            if (isOfflineMutationQueuedError(err)) return
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.templateListsSnap)
        },
        onSuccess: (data) => {
            replaceTemplateInListsById(queryClient, data.id, data)
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useCreateTemplateFromWorkoutMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (payload: WorkoutTemplateCreateFromWorkoutRequest) =>
            workoutsApi.createTemplateFromWorkout(payload),
        onSuccess: (data) => {
            trackBusinessMetric('created_template', {
                template_id: data.id,
                exercise_count: data.exercises.length,
                source: 'workout',
            })
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useCloneWorkoutTemplateMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ templateId, payload }: CloneTemplateVariables) =>
            workoutsApi.cloneTemplate(templateId, payload ?? {}),
        onSuccess: (data, vars) => {
            trackBusinessMetric('created_template', {
                template_id: data.id,
                source_template_id: vars.templateId,
                exercise_count: data.exercises.length,
                source: 'clone',
            })
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useDeleteWorkoutTemplateMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (templateId: number) => workoutsApi.deleteTemplate(templateId),
        onMutate: async (templateId) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const templateListsSnap = takeWorkoutsTemplateListsSnapshot(queryClient)

            queryClient.setQueriesData<WorkoutTemplateListResponse>(
                { queryKey: ['workouts', 'templates', 'list'], exact: false },
                (current) => {
                    if (!current) return current
                    const items = current.items.filter((item) => item.id !== templateId)
                    if (items.length === current.items.length) return current
                    return {
                        ...current,
                        items,
                        total: Math.max(0, current.total - 1),
                    }
                },
            )
            return { templateListsSnap } satisfies DeleteTemplateContext
        },
        onError: (_err, _templateId, ctx) => {
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.templateListsSnap)
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useArchiveWorkoutTemplateMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (templateId: number) => workoutsApi.archiveTemplate(templateId),
        onMutate: async (templateId) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const templateListsSnap = takeWorkoutsTemplateListsSnapshot(queryClient)

            queryClient.setQueriesData<WorkoutTemplateListResponse>(
                { queryKey: ['workouts', 'templates', 'list'], exact: false },
                (current) => {
                    if (!current) return current
                    const items = current.items.filter((item) => item.id != templateId)
                    if (items.length === current.items.length) return current
                    return {
                        ...current,
                        items,
                        total: Math.max(0, current.total - 1),
                    }
                },
            )
            return { templateListsSnap } satisfies ArchiveTemplateContext
        },
        onError: (_err, _templateId, ctx) => {
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.templateListsSnap)
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useUnarchiveWorkoutTemplateMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (templateId: number) => workoutsApi.unarchiveTemplate(templateId),
        onMutate: async (templateId) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const templateListsSnap = takeWorkoutsTemplateListsSnapshot(queryClient)

            queryClient.setQueriesData<WorkoutTemplateListResponse>(
                { queryKey: ['workouts', 'templates', 'list'], exact: false },
                (current) => {
                    if (!current) return current
                    const items = current.items.filter((item) => item.id != templateId)
                    if (items.length === current.items.length) return current
                    return {
                        ...current,
                        items,
                        total: Math.max(0, current.total - 1),
                    }
                },
            )
            return { templateListsSnap } satisfies UnarchiveTemplateContext
        },
        onError: (_err, _templateId, ctx) => {
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.templateListsSnap)
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useUpdateWorkoutSessionMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ workoutId, payload }: UpdateWorkoutSessionVariables) => {
            try {
                return await withWorkoutNetworkRetries(() => workoutsApi.updateWorkoutSession(workoutId, payload))
            } catch (e) {
                if (isRecoverableSyncError(e)) {
                    enqueueOfflineWorkoutSessionUpdate(workoutId, payload)
                }
                throw e
            }
        },
        onSuccess: (data, variables) => {
            queryClient.setQueryData(queryKeys.workouts.historyItem(variables.workoutId), data)
        },
    })
}

export function useStartWorkoutMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (payload: WorkoutStartRequest) => {
            try {
                return await workoutsApi.startWorkout(payload)
            } catch (e) {
                if (isRecoverableSyncError(e)) {
                    enqueueOfflineWorkoutStart(payload)
                }
                throw e
            }
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const tempId = nextOptimisticNegativeId()
            const scheduledAtIso = new Date().toISOString()
            const calendarSnap = takeWorkoutsCalendarSnapshot(queryClient)
            const historyListsSnap = takeWorkoutsHistoryListsSnapshot(queryClient)

            const calEntry = buildCalendarEntryFromStartPayload(tempId, payload, scheduledAtIso)
            appendCalendarWorkoutForMatchingMonth(queryClient, calEntry)
            const histItem = optimisticHistoryItemForStart(tempId, payload, scheduledAtIso)
            prependHistoryListItem(queryClient, histItem)

            return {
                tempId,
                calendarSnap,
                historyListsSnap,
            } satisfies StartMutationContext
        },
        onError: (err, _payload, ctx) => {
            if (isOfflineMutationQueuedError(err)) return
            if (ctx) {
                restoreSnapshotEntries(queryClient, ctx.calendarSnap)
                restoreSnapshotEntries(queryClient, ctx.historyListsSnap)
            }
            toast.error(`Не удалось запустить тренировку: ${getErrorMessage(err)}`, {
                toastKey: 'start-workout-error',
            })
        },
        onSuccess: async (data, variables, ctx) => {
            if (!ctx) return
            const cal = calendarEntryFromStartResponse(data, variables)
            replaceCalendarWorkoutId(queryClient, ctx.tempId, cal)
            let item = historyItemFromStartResponse(data, variables)
            if (variables.template_id != null) {
                let template = findTemplateInCaches(queryClient, variables.template_id)
                if (!template) {
                    try {
                        template = await queryClient.fetchQuery({
                            queryKey: queryKeys.workouts.templatesDetail(variables.template_id),
                            queryFn: () => workoutsApi.getTemplate(variables.template_id!),
                            ...offlineListQueryDefaults,
                            staleTime: 60_000,
                        })
                    } catch {
                        // шаблон мог быть недоступен — остаётся пустой план до ручного ввода
                    }
                }
                if (template) {
                    item = { ...item, exercises: completedExercisesFromTemplate(template) }
                }
            }
            queryClient.setQueryData(queryKeys.workouts.historyItem(data.id), item)
            replaceHistoryListTemporalId(queryClient, ctx.tempId, item)
            trackBusinessMetric('started_workout', {
                workout_id: data.id,
                template_id: variables.template_id ?? null,
                type: variables.type ?? null,
            })
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
        },
    })
}

export function useCompleteWorkoutMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ workoutId, payload }: CompleteWorkoutVariables) => {
            try {
                return await withWorkoutNetworkRetries(() => workoutsApi.completeWorkout(workoutId, payload))
            } catch (e) {
                if (isRecoverableSyncError(e)) {
                    emitWorkoutSyncTelemetry('workout_completed_offline', {
                        workout_id: workoutId,
                        channel: 'sync_queue',
                    })
                    enqueueOfflineWorkoutComplete(workoutId, payload)
                }
                throw e
            }
        },
        onMutate: async ({ workoutId, payload }) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const calendarSnap = takeWorkoutsCalendarSnapshot(queryClient)
            const historyListsSnap = takeWorkoutsHistoryListsSnapshot(queryClient)
            const detailKey = queryKeys.workouts.historyItem(workoutId)
            const previousDetail = queryClient.getQueryData<WorkoutHistoryItem>(detailKey)

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

            return {
                calendarSnap,
                historyListsSnap,
                previousDetail,
                detailKey,
            } satisfies CompleteMutationContext
        },
        onError: (err, _vars, ctx) => {
            if (isOfflineMutationQueuedError(err)) return
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.calendarSnap)
            restoreSnapshotEntries(queryClient, ctx.historyListsSnap)
            queryClient.setQueryData(ctx.detailKey, ctx.previousDetail)
        },
        onSuccess: (data, variables) => {
            const activeDraftId = useWorkoutSessionDraftStore.getState().workoutId
            if (activeDraftId === data.id) {
                useWorkoutSessionDraftStore.getState().clearDraft()
            }
            const item = historyItemFromCompleteResponse(data)
            queryClient.setQueryData(queryKeys.workouts.historyItem(data.id), item)
            replaceHistoryListTemporalId(queryClient, data.id, item)
            patchCalendarWorkoutComplete(
                queryClient,
                data.id,
                variables.payload,
                data.completed_at,
                data.date,
            )
            trackBusinessMetric('completed_workout', {
                workout_id: data.id,
                duration_minutes: data.duration,
                exercise_count: data.exercises.length,
            })
        },
        onSettled: () => {
            invalidateWorkouts(queryClient)
            void queryClient.invalidateQueries({ queryKey: ['analytics'] })
        },
    })
}

export type PatchWorkoutSetVariables = {
    workoutId: number
    setId: number
    payload: WorkoutSetPatchRequest
}

/**
 * Updates a single set in a workout history item.
 * Used for optimistic update in usePatchWorkoutSet.
 */
function updateSetInHistoryItemOptimistic(
    prev: WorkoutHistoryItem,
    exerciseId: number,
    setNumber: number,
    patch: WorkoutSetPatchRequest,
): WorkoutHistoryItem {
    return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
            if (exercise.exercise_id !== exerciseId) return exercise
            return {
                ...exercise,
                sets_completed: exercise.sets_completed.map((set) => {
                    if (set.set_number !== setNumber) return set
                    return {
                        ...set,
                        ...(patch.reps !== null && patch.reps !== undefined ? { reps: patch.reps } : {}),
                        ...(patch.weight !== null && patch.weight !== undefined ? { weight: patch.weight } : {}),
                        ...(patch.rpe !== null && patch.rpe !== undefined ? { rpe: patch.rpe } : {}),
                        ...(patch.rest_seconds !== null && patch.rest_seconds !== undefined ? { rest_seconds: patch.rest_seconds } : {}),
                        ...(patch.completed !== null && patch.completed !== undefined ? { completed: patch.completed } : {}),
                        ...(patch.notes !== null && patch.notes !== undefined ? { notes: patch.notes } : {}),
                    }
                }),
            }
        }),
    }
}

/**
 * Hook for editing individual completed sets from workout history.
 * Supports editing reps, weight, rpe, rest_seconds, and completed status.
 */
export function usePatchWorkoutSetMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ workoutId, setId, payload }: PatchWorkoutSetVariables) => {
            return workoutsApi.patchWorkoutSet(workoutId, setId, payload)
        },
        onMutate: async ({ workoutId, setId, payload }) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const detailKey = queryKeys.workouts.historyItem(workoutId)
            const previousDetail = queryClient.getQueryData<WorkoutHistoryItem>(detailKey)

            if (previousDetail) {
                // Find the exercise and set number from the setId
                // setId is the database ID of the workout_set row
                let exerciseId: number | null = null
                let setNumber: number | null = null
                for (const exercise of previousDetail.exercises) {
                    for (const set of exercise.sets_completed) {
                        // Match by database ID if available, otherwise fall back to set_number
                        if (set.id === setId || set.set_number === setId) {
                            exerciseId = exercise.exercise_id
                            setNumber = set.set_number
                            break
                        }
                    }
                    if (exerciseId !== null) break
                }

                if (exerciseId !== null && setNumber !== null) {
                    queryClient.setQueryData<WorkoutHistoryItem>(
                        detailKey,
                        updateSetInHistoryItemOptimistic(previousDetail, exerciseId, setNumber, payload),
                    )
                }
            }

            return { previousDetail, detailKey }
        },
        onError: (err, _vars, ctx) => {
            if (isOfflineMutationQueuedError(err)) return
            if (!ctx) return
            if (ctx.previousDetail) {
                queryClient.setQueryData(ctx.detailKey, ctx.previousDetail)
            }
            toast.error(`Не удалось сохранить изменения: ${getErrorMessage(err)}`, {
                toastKey: 'patch-set-error',
            })
        },
        onSuccess: (data, variables) => {
            // Update cache with actual response data
            const detailKey = queryKeys.workouts.historyItem(variables.workoutId)
            const previousDetail = queryClient.getQueryData<WorkoutHistoryItem>(detailKey)
            if (previousDetail) {
                queryClient.setQueryData<WorkoutHistoryItem>(
                    detailKey,
                    updateSetInHistoryItemOptimistic(
                        previousDetail,
                        data.exercise_id,
                        data.set_number,
                        {
                            reps: data.reps ?? undefined,
                            weight: data.weight ?? undefined,
                            rpe: data.rpe ? Number(data.rpe) : undefined,
                            rest_seconds: data.rest_seconds ?? undefined,
                            completed: data.completed,
                            notes: data.notes ?? undefined,
                        },
                    ),
                )
            }
            trackBusinessMetric('edited_workout_set', {
                workout_id: data.workout_id,
                set_id: data.id,
                exercise_id: data.exercise_id,
            })
        },
        onSettled: (_data, _err, variables) => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workouts.historyItem(variables.workoutId),
            })
        },
    })
}
