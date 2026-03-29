/**
 * Очередь офлайн-мутаций: элементы сериализуются в localStorage и
 * переотправляются по сети с защитой от дублей по {@link SyncQueueItem.dedupeKey}.
 */
export type SyncQueueItemStatus = 'pending' | 'processing'

export type SyncQueueItem = {
    id: string
    /** Тип операции — см. {@link WORKOUT_SYNC_KINDS} и исполнитель. */
    kind: string
    /**
     * Логический ключ идемпотентности: при enqueue новая запись с тем же ключом
     * заменяет ещё не отправленную (последняя версия payload побеждает).
     */
    dedupeKey: string
    payload: unknown
    createdAt: number
    attempts: number
    status: SyncQueueItemStatus
    lastError?: string
    /** Unix ms — не раньше этого времени пробовать снова (backoff). */
    nextRetryAt: number
}

export type EnqueueSyncMutationInput = {
    kind: string
    dedupeKey: string
    payload: unknown
}

export type EnqueueResult = {
    item: SyncQueueItem
    /** true, если предыдущий pending с тем же dedupeKey был удалён. */
    replacedDuplicate: boolean
}

export const SYNC_QUEUE_STORAGE_KEY = 'fittracker_sync_queue_v1'

export const SYNC_QUEUE_MAX_ITEMS = 200
