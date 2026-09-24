import { useCallback, useEffect, useState } from 'react'
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

/**
 * Единственная подписка на движок очереди во всём UI. Читающие хуки строятся на ней,
 * поэтому в компонентах не бывает двух подписок на одно состояние.
 */
function useQueueSnapshot() {
    const engine = getSyncQueueEngine()
    const [, bump] = useState(0)

    useEffect(() => engine.subscribe(() => bump((n) => n + 1)), [engine])

    const items = engine.getSnapshot()
    const isFlushing = engine.isFlushActive()

    // Секундный тик нужен только ради обратного отсчёта до повтора.
    useEffect(() => {
        if (items.length === 0) return
        const id = window.setInterval(() => bump((n) => n + 1), 1000)
        return () => clearInterval(id)
    }, [items.length])

    return { items, isFlushing, retryInSec: backoffRetryInSec(items, Date.now()) }
}

export interface UseSyncQueueOptions {
    /** Сузить срез до одного типа операции */
    kind?: string
    /** Сузить срез до одной тренировки — по `payload.workoutId` */
    workoutId?: number
}

export interface SyncQueueSlice {
    /** Элементы очереди в срезе */
    items: SyncQueueItem[]
    failedItems: SyncQueueItem[]
    pendingItems: SyncQueueItem[]
    processingItems: SyncQueueItem[]
    /** Сколько элементов в срезе */
    totalCount: number
    /** Сколько элементов в срезе требуют повтора */
    failedCount: number
    /** Сейчас идёт отправка очереди */
    isFlushing: boolean
    /** Секунд до следующей попытки при backoff; 0 если не в ожидании повтора */
    retryInSec: number
    /** Повторить один элемент */
    retryItem: (itemId: string) => Promise<void>
    /**
     * Повторить все упавшие элементы среза и подтолкнуть отправку очереди.
     * Ровно то, что делает кнопка «Повторить сейчас»: если повторов не осталось,
     * действие просто пробует отправить очередь.
     */
    retryAllFailed: () => Promise<void>
}

/**
 * Читающая поверхность очереди офлайн-синхронизации: снимок (при желании суженный
 * до типа операции или тренировки), его счётчики и действия. Без аргументов — вся очередь.
 *
 * Компоненту не нужен движок: он получает и состояние, и действия отсюда.
 */
export function useSyncQueue(options: UseSyncQueueOptions = {}): SyncQueueSlice {
    const { kind, workoutId } = options
    const { items: snapshot, isFlushing, retryInSec } = useQueueSnapshot()

    const items = snapshot.filter((item) => {
        if (kind && item.kind !== kind) return false
        if (workoutId != null) {
            const payload = item.payload as Record<string, unknown> | undefined
            if (payload?.workoutId !== workoutId) return false
        }
        return true
    })

    const failedItems = items.filter((item) => item.status === 'failed')
    const pendingItems = items.filter((item) => item.status === 'pending')
    const processingItems = items.filter((item) => item.status === 'processing')

    const retryItem = useCallback(async (itemId: string) => {
        await getSyncQueueEngine().retryItem(itemId)
    }, [])

    const retryAllFailed = useCallback(async () => {
        const engine = getSyncQueueEngine()
        for (const item of failedItems) {
            try {
                await engine.retryItem(item.id)
            } catch (error) {
                console.error(`Failed to retry item ${item.id}:`, error)
            }
        }
        // Если повторять нечего (элементы ушли из очереди после отрисовки кнопки),
        // всё равно пробуем отправить то, что готово к отправке.
        await engine.flush()
    }, [failedItems])

    return {
        items,
        failedItems,
        pendingItems,
        processingItems,
        totalCount: items.length,
        failedCount: failedItems.length,
        isFlushing,
        retryInSec,
        retryItem,
        retryAllFailed,
    }
}
