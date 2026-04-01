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

const WORKOUT_START_DEDUPE_WINDOW_MS = 10_000

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

/**
 * Старт тренировки: защищаемся от дублей в коротком окне (двойной тап / повтор).
 * При этом не запрещаем пользователю начать тренировку ещё раз позже.
 */
export function enqueueOfflineWorkoutStart(payload: WorkoutStartRequest): never {
    const bucket = Math.floor(Date.now() / WORKOUT_START_DEDUPE_WINDOW_MS)
    const dedupeKey = payloadDedupeKey(`workout:start:${bucket}`, payload)
    enqueueSyncMutation({
        kind: WORKOUT_SYNC_KINDS.START,
        dedupeKey,
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
