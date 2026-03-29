export type { EnqueueResult, EnqueueSyncMutationInput, SyncQueueItem } from './types'
export { SYNC_QUEUE_MAX_ITEMS, SYNC_QUEUE_STORAGE_KEY } from './types'
export { SyncQueueEngine, getSyncQueueEngine, resetSyncQueueEngineForTests } from './engine'
export type { SyncQueueEngineOptions, SyncQueueExecuteFn } from './engine'
export { isRecoverableSyncError } from './recoverableError'
export { WORKOUT_SYNC_KINDS, type WorkoutSyncKind } from './workoutKinds'
export { stableStringify, hashStringDjb2, payloadDedupeKey } from './stablePayloadKey'
export { executeWorkoutSyncOp } from './executeWorkoutSyncOp'
export {
    OfflineMutationQueuedError,
    isOfflineMutationQueuedError,
} from './offlineMutationQueuedError'

import type { EnqueueResult, EnqueueSyncMutationInput } from './types'
import { getSyncQueueEngine } from './engine'

export function enqueueSyncMutation(input: EnqueueSyncMutationInput): EnqueueResult {
    return getSyncQueueEngine().enqueue(input)
}

/** Попытаться сразу отправить очередь (например после enqueue при восстановлении сети). */
export function requestSyncFlush(): void {
    void getSyncQueueEngine().flush()
}
