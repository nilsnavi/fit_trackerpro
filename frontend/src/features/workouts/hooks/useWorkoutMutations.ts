import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import type {
    WorkoutCompleteRequest,
    WorkoutStartRequest,
    WorkoutTemplateCreateRequest,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { trackBusinessMetric } from '@shared/lib/businessMetrics'
import {
    appendCalendarWorkoutForMatchingMonth,
    buildCalendarEntryFromStartPayload,
    calendarEntryFromStartResponse,
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

type StartMutationContext = {
    tempId: number
    calendarSnap: ReturnType<typeof takeWorkoutsCalendarSnapshot>
    historyListsSnap: ReturnType<typeof takeWorkoutsHistoryListsSnapshot>
}

type CreateTemplateContext = {
    tempId: number
    templateListsSnap: ReturnType<typeof takeWorkoutsTemplateListsSnapshot>
}

type UpdateTemplateVariables = {
    templateId: number
    payload: WorkoutTemplateCreateRequest
}

type UpdateTemplateContext = {
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
        mutationFn: (payload: WorkoutTemplateCreateRequest) => workoutsApi.createTemplate(payload),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: WORKOUTS_ROOT })
            const tempId = nextOptimisticNegativeId()
            const templateListsSnap = takeWorkoutsTemplateListsSnapshot(queryClient)
            const row = optimisticTemplateRow(tempId, payload)
            prependTemplateToMatchingLists(queryClient, row, payload)
            return { tempId, templateListsSnap } satisfies CreateTemplateContext
        },
        onError: (_err, _payload, ctx) => {
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
        mutationFn: ({ templateId, payload }: UpdateTemplateVariables) =>
            workoutsApi.updateTemplate(templateId, payload),
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
        onError: (_err, _vars, ctx) => {
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

export function useStartWorkoutMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: WorkoutStartRequest) => workoutsApi.startWorkout(payload),
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
        onError: (_err, _payload, ctx) => {
            if (!ctx) return
            restoreSnapshotEntries(queryClient, ctx.calendarSnap)
            restoreSnapshotEntries(queryClient, ctx.historyListsSnap)
        },
        onSuccess: (data, variables, ctx) => {
            if (!ctx) return
            const cal = calendarEntryFromStartResponse(data, variables)
            replaceCalendarWorkoutId(queryClient, ctx.tempId, cal)
            const item = historyItemFromStartResponse(data, variables)
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
        mutationFn: ({ workoutId, payload }: CompleteWorkoutVariables) =>
            workoutsApi.completeWorkout(workoutId, payload),
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
        onError: (_err, _vars, ctx) => {
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
        },
    })
}
