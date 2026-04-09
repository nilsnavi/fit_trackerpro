import { useCallback, useEffect, useState } from 'react'
import { getSyncQueueEngine, type SyncQueueItem } from '@shared/offline/syncQueue'

interface UseSyncQueueWithRetryState {
    /** Все элементы в очереди */
    allItems: SyncQueueItem[]
    /** Элементы с ошибками, требующие повтора */
    failedItems: SyncQueueItem[]
    /** Элементы, ожидающие отправки */
    pendingItems: SyncQueueItem[]
    /** Элементы, которые сейчас обрабатываются */
    processingItems: SyncQueueItem[]
    /** Общее количество элементов в очереди */
    totalQueuedCount: number
    /** Количество элементов с ошибками */
    failedCount: number
    /** Сейчас идёт синхронизация */
    isSyncing: boolean
}

interface UseSyncQueueWithRetryActions {
    /** Повторить синхронизацию конкретного элемента */
    retryItem: (itemId: string) => Promise<void>
    /** Повторить все элементы с ошибками */
    retryAllFailed: () => Promise<void>
    /** Очистить элемент из очереди (для нерекуперабельных ошибок) */
    deleteItem: (itemId: string) => void
    /** Очистить все ошибки */
    clearAllFailed: () => void
    /** Получить детали ошибки для элемента */
    getItemError: (itemId: string) => string | undefined
}

export interface UseSyncQueueWithRetryResult extends UseSyncQueueWithRetryState, UseSyncQueueWithRetryActions {}

/**
 * Хук для управления очередью синхронизации с поддержкой retry.
 * Предоставляет состояние и действия для каждого элемента в очереди.
 *
 * @example
 * ```tsx
 * const { failedItems, retryItem, failedCount } = useSyncQueueWithRetry()
 *
 * return (
 *   <div>
 *     <p>Ошибки: {failedCount}</p>
 *     {failedItems.map(item => (
 *       <button key={item.id} onClick={() => retryItem(item.id)}>
 *         Повторить: {item.kind}
 *       </button>
 *     ))}
 *   </div>
 * )
 * ```
 */
export function useSyncQueueWithRetry(): UseSyncQueueWithRetryResult {
    const [allItems, setAllItems] = useState<SyncQueueItem[]>([])
    const [isSyncing, setIsSyncing] = useState(false)

    // Синхронизировать состояние очереди
    useEffect(() => {
        const engine = getSyncQueueEngine()

        const updateItems = () => {
            setAllItems([...engine.getAllItems()])
        }

        // Initial load
        updateItems()

        // Subscribe to changes
        const unsubscribe = engine.subscribe(updateItems)

        // Monitor processing state
        const processingInterval = setInterval(() => {
            const items = engine.getAllItems()
            const hasProcessing = items.some((item) => item.status === 'processing')
            setIsSyncing(hasProcessing)
        }, 100)

        return () => {
            unsubscribe()
            clearInterval(processingInterval)
        }
    }, [])

    // Вычисленные значения
    const failedItems = allItems.filter((item) => item.status === 'failed')
    const pendingItems = allItems.filter((item) => item.status === 'pending')
    const processingItems = allItems.filter((item) => item.status === 'processing')

    // Actions
    const retryItem = useCallback(async (itemId: string) => {
        const engine = getSyncQueueEngine()
        await engine.retryItem(itemId)
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
    }, [failedItems])

    const deleteItem = useCallback((itemId: string) => {
        const engine = getSyncQueueEngine()
        engine.deleteItem(itemId)
    }, [])

    const clearAllFailed = useCallback(() => {
        const engine = getSyncQueueEngine()
        for (const item of failedItems) {
            engine.deleteItem(item.id)
        }
    }, [failedItems])

    const getItemError = useCallback((itemId: string) => {
        const item = allItems.find((i) => i.id === itemId)
        return item?.lastError
    }, [allItems])

    return {
        // State
        allItems,
        failedItems,
        pendingItems,
        processingItems,
        totalQueuedCount: allItems.length,
        failedCount: failedItems.length,
        isSyncing,

        // Actions
        retryItem,
        retryAllFailed,
        deleteItem,
        clearAllFailed,
        getItemError,
    }
}

/**
 * Хук для отслеживания синхронизации по типу операции.
 * Полезно для показа статуса конкретного типа операции на активной тренировке.
 */
export interface UseSyncQueueByKindOptions {
    /** Фильтровать по типу операции */
    kind?: string
    /** Фильтровать по workoutId в payload */
    workoutId?: number
}

export function useSyncQueueByKind(options: UseSyncQueueByKindOptions = {}) {
    const { kind, workoutId } = options
    const {
        allItems,
        failedItems: _failedItems,
        pendingItems: _pendingItems,
        processingItems: _processingItems,
        ...rest
    } = useSyncQueueWithRetry()

    const filteredItems = allItems.filter((item) => {
        if (kind && item.kind !== kind) return false
        if (workoutId) {
            const payload = item.payload as Record<string, unknown> | undefined
            if (payload?.workoutId !== workoutId) return false
        }
        return true
    })

    const filteredFailedItems = filteredItems.filter((i) => i.status === 'failed')
    const filteredPendingItems = filteredItems.filter((i) => i.status === 'pending')
    const filteredProcessingItems = filteredItems.filter((i) => i.status === 'processing')

    return {
        items: filteredItems,
        failedItems: filteredFailedItems,
        pendingItems: filteredPendingItems,
        processingItems: filteredProcessingItems,
        totalCount: filteredItems.length,
        ...rest,
    }
}
