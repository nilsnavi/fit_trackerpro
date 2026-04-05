import { useEffect, useRef } from 'react'
import { useNetworkOnline } from '@shared/hooks/useNetworkOnline'
import { useSyncQueueUiState } from '@shared/hooks/useSyncQueueUiState'
import { getSyncQueueEngine } from '@shared/offline/syncQueue'
import { toast } from '@shared/stores/toastStore'

type SyncToastState = 'idle' | 'offline' | 'syncing' | 'queued' | 'failed'

/**
 * Глобальный bridge: транслирует состояние офлайн-очереди в единый sync-status toast.
 */
export function SyncStatusToastBridge() {
    const online = useNetworkOnline()
    const { queuedCount, failedCount, isFlushing, retryInSec } = useSyncQueueUiState()

    const prevStateRef = useRef<SyncToastState>('idle')

    useEffect(() => {
        if (!online) {
            toast.syncStatus('offline', { queuedCount })
            prevStateRef.current = 'offline'
            return
        }

        if (isFlushing) {
            toast.syncStatus('syncing', { queuedCount })
            prevStateRef.current = 'syncing'
            return
        }

        if (failedCount > 0) {
            toast.syncStatus('failed', {
                failedCount,
                onRetryNow: () => {
                    const engine = getSyncQueueEngine()
                    void engine.flush()
                },
            })
            prevStateRef.current = 'failed'
            return
        }

        if (queuedCount > 0) {
            toast.syncStatus('queued', { queuedCount, retryInSec })
            prevStateRef.current = 'queued'
            return
        }

        if (prevStateRef.current !== 'idle') {
            toast.syncStatus('synced')
        }

        prevStateRef.current = 'idle'
    }, [online, queuedCount, failedCount, isFlushing, retryInSec])

    return null
}
