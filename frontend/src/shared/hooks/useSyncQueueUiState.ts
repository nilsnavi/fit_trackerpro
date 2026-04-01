import { useEffect, useState } from 'react'
import { getSyncQueueEngine } from '@shared/offline/syncQueue'
import type { SyncQueueItem } from '@shared/offline/syncQueue'

function backoffRetryInSec(items: readonly SyncQueueItem[], now: number): number {
    const ready = items.some((i) => i.status === 'pending' && i.nextRetryAt <= now)
    if (ready) return 0
    const future = items
        .filter((i) => i.status === 'pending' && i.nextRetryAt > now)
        .map((i) => i.nextRetryAt)
    if (future.length === 0) return 0
    const minAt = Math.min(...future)
    return Math.max(0, Math.ceil((minAt - now) / 1000))
}

export type SyncQueueUiState = {
    queuedCount: number
    failedCount: number
    isFlushing: boolean
    /** Секунд до следующей попытки при backoff; 0 если не в ожидании повтора. */
    retryInSec: number
}

/**
 * Подписка на очередь офлайн-синхронизации для отображения в UI.
 */
export function useSyncQueueUiState(): SyncQueueUiState {
    const engine = getSyncQueueEngine()
    const [, bump] = useState(0)

    useEffect(() => engine.subscribe(() => bump((n) => n + 1)), [engine])

    const items = engine.getSnapshot()
    const queuedCount = items.length
    const failedCount = items.filter((i) => i.status === 'failed').length
    const isFlushing = engine.isFlushActive()

    useEffect(() => {
        if (queuedCount === 0) return
        const id = window.setInterval(() => bump((n) => n + 1), 1000)
        return () => clearInterval(id)
    }, [queuedCount])

    const now = Date.now()
    return {
        queuedCount,
        failedCount,
        isFlushing,
        retryInSec: backoffRetryInSec(items, now),
    }
}
