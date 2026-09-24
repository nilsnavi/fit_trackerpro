import { useEffect, useRef } from 'react'
import { useNetworkOnline } from '@shared/hooks/useNetworkOnline'
import { useSyncQueue } from '@shared/hooks/useSyncQueue'
import { toast } from '@shared/stores/toastStore'

type SyncToastState = 'idle' | 'offline' | 'syncing' | 'queued' | 'failed'

/**
 * Глобальный bridge: транслирует состояние офлайн-очереди в единый sync-status toast.
 */
export function SyncStatusToastBridge() {
    const online = useNetworkOnline()
    const {
        totalCount: queuedCount,
        failedCount,
        isFlushing,
        retryInSec,
        retryAllFailed,
    } = useSyncQueue()

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
                // Действие читающей поверхности: повторяет упавшее и подталкивает отправку.
                onRetryNow: () => {
                    void retryAllFailed()
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
    }, [online, queuedCount, failedCount, isFlushing, retryInSec, retryAllFailed])

    return null
}
