import type {
    WorkoutCompleteRequest,
    WorkoutStartRequest,
    WorkoutTemplateCreateRequest,
} from '@features/workouts/types/workouts'
import {
    OfflineMutationQueuedError,
    WORKOUT_SYNC_KINDS,
    enqueueSyncMutation,
    payloadDedupeKey,
    requestSyncFlush,
} from '@shared/offline/syncQueue'

/** Очередь создания шаблона: одинаковый payload заменяет предыдущий pending. */
export function enqueueOfflineTemplateCreate(payload: WorkoutTemplateCreateRequest): never {
    enqueueSyncMutation({
        kind: WORKOUT_SYNC_KINDS.TEMPLATE_CREATE,
        dedupeKey: payloadDedupeKey('template:create', payload),
        payload,
    })
    requestSyncFlush()
    throw new OfflineMutationQueuedError()
}

/** Одна незавершённая очередь на обновление конкретного шаблона (последний payload). */
export function enqueueOfflineTemplateUpdate(
    templateId: number,
    payload: WorkoutTemplateCreateRequest,
): never {
    enqueueSyncMutation({
        kind: WORKOUT_SYNC_KINDS.TEMPLATE_UPDATE,
        dedupeKey: `template:update:${templateId}`,
        payload: { templateId, body: payload },
    })
    requestSyncFlush()
    throw new OfflineMutationQueuedError()
}

/** Каждый старт — отдельный id вызова (дубли по двойному тапу = отдельные записи). */
export function enqueueOfflineWorkoutStart(
    invocationId: string,
    payload: WorkoutStartRequest,
): never {
    enqueueSyncMutation({
        kind: WORKOUT_SYNC_KINDS.START,
        dedupeKey: `workout:start:${invocationId}`,
        payload,
    })
    requestSyncFlush()
    throw new OfflineMutationQueuedError()
}

/** Одно завершение на workout_id в очереди. */
export function enqueueOfflineWorkoutComplete(
    workoutId: number,
    payload: WorkoutCompleteRequest,
): never {
    enqueueSyncMutation({
        kind: WORKOUT_SYNC_KINDS.COMPLETE,
        dedupeKey: `workout:complete:${workoutId}`,
        payload: { workoutId, body: payload },
    })
    requestSyncFlush()
    throw new OfflineMutationQueuedError()
}
