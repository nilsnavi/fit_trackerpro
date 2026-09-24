import { useEffect, useMemo, useState } from 'react'
import { useNetworkOnline } from '@shared/hooks/useNetworkOnline'
import { useSyncQueue } from '@shared/hooks/useSyncQueue'
import { cn } from '@shared/lib/cn'

/** Форма элемента очереди — ровно то, что отдаёт читающий хук. */
type QueueRowItem = ReturnType<typeof useSyncQueue>['items'][number]

interface WorkoutSyncQueueStatusProps {
    workoutId: number
    className?: string
    /** Показывать детальный список если верно */
    showDetails?: boolean
}

/**
 * Статус-бадж с очередью синхронизации для актвного тренировки.
 * Показывает:
 * - "Сохранено локально" (offline-queued)
 * - "Синхронизация..." (syncing)
 * - "Синхронизировано" (synced)
 * - "Ошибка синхронизации" с кнопкой повтора (failed)
 *
 * Для каждого элемента в очереди есть кнопка повтора.
 */
export function WorkoutSyncQueueStatus({
    workoutId,
    className,
    showDetails = false,
}: WorkoutSyncQueueStatusProps) {
    const online = useNetworkOnline()
    // Вся очередь приходит из одной читающей поверхности: движок синхронизации
    // компоненту не нужен, а вторая подписка дублировала бы его состояние.
    const {
        items,
        failedItems,
        pendingItems,
        processingItems,
        totalCount,
        failedCount,
        isFlushing,
        retryInSec,
        retryItem,
        retryAllFailed,
    } = useSyncQueue({ workoutId })
    const [isExpanded, setIsExpanded] = useState(false)
    const [hideSynced, setHideSynced] = useState(false)

    // Определяем статус
    const statusType = useMemo(() => {
        if (!online) return 'offline' as const
        if (isFlushing || processingItems.length > 0) return 'syncing' as const
        if (failedItems.length > 0) return 'error' as const
        if (pendingItems.length > 0) return 'queued' as const
        return 'synced' as const
    }, [online, isFlushing, processingItems.length, failedItems.length, pendingItems.length])

    // Auto-hide synced badge через 3 секунды, показать сразу при других статусах
    useEffect(() => {
        if (statusType !== 'synced') {
            setHideSynced(false)
            return
        }
        const timer = setTimeout(() => setHideSynced(true), 3000)
        return () => clearTimeout(timer)
    }, [statusType])

    // Скрыть компонент полностью, когда всё синхронизировано и прошло 3с
    if (statusType === 'synced' && hideSynced) return null

    const statusConfig = {
        offline: {
            icon: '📡',
            label: 'Нет сети',
            color: 'bg-gray-500',
            textColor: 'text-gray-700',
        },
        queued: {
            icon: '⏳',
            label: 'Сохранено локально',
            color: 'bg-yellow-500',
            textColor: 'text-yellow-700',
        },
        syncing: {
            icon: '🔄',
            label: 'Синхронизация...',
            color: 'bg-blue-500',
            textColor: 'text-blue-700',
        },
        synced: {
            icon: '✅',
            label: 'Синхронизировано',
            color: 'bg-green-500',
            textColor: 'text-green-700',
        },
        error: {
            icon: '❌',
            label: 'Ошибка синхронизации',
            color: 'bg-red-500',
            textColor: 'text-red-700',
        },
    }

    const config = statusConfig[statusType]

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {/* Главный бадж статуса */}
            <div
                className={cn(
                    'px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity',
                    config.color,
                    'text-white',
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span>{config.icon}</span>
                <span className="text-sm font-medium">{config.label}</span>
                {(totalCount > 0 || failedCount > 0) && (
                    <span className="ml-auto text-xs font-bold">
                        {failedCount > 0 && <span className="text-red-200">{failedCount} ошибок</span>}
                        {failedCount === 0 && totalCount > 0 && (
                            <span className="text-yellow-100">{totalCount} в очереди</span>
                        )}
                    </span>
                )}
            </div>

            {/* Детали и кнопка повтора */}
            {statusType === 'error' && (
                <button
                    type="button"
                    onClick={retryAllFailed}
                    className="px-3 py-2 text-sm font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                    Повторить все ({failedItems.length})
                </button>
            )}

            {/* Список элементов если развёрнут */}
            {isExpanded && showDetails && items.length > 0 && (
                <div className="mt-2 border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="text-xs font-semibold text-gray-600 uppercase">Элементы очереди</div>
                    {items.map((item) => (
                        <SyncQueueItemRow
                            key={item.id}
                            item={item}
                            onRetry={() => retryItem(item.id)}
                        />
                    ))}
                </div>
            )}

            {/* Статус синхронизации в реальном времени */}
            {(isFlushing || (statusType === 'queued' && retryInSec > 0)) && (
                <div className="text-xs text-gray-600">
                    {isFlushing && 'Синхронизация в процессе...'}
                    {!isFlushing && statusType === 'queued' && retryInSec > 0 && (
                        <span>Повтор через {retryInSec}с</span>
                    )}
                </div>
            )}
        </div>
    )
}

interface SyncQueueItemRowProps {
    item: QueueRowItem
    onRetry: () => void
}

function SyncQueueItemRow({ item, onRetry }: SyncQueueItemRowProps) {
    const payload = item.payload as Record<string, unknown> | undefined
    const kind = item.kind || 'unknown'
    const kindLabel = mapKindToLabel(kind)

    const statusIcon = {
        pending: '⏳',
        processing: '🔄',
        failed: '❌',
    }[item.status]

    return (
        <div className="flex items-center justify-between text-xs p-2 bg-white rounded border border-gray-200 gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span>{statusIcon}</span>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium text-gray-800 truncate">{kindLabel}</div>
                    <div className="text-gray-600">
                        {getPayloadPreview(kind, payload)}
                    </div>
                    {item.lastError && (
                        <div className="text-red-600 text-xs">
                            {item.lastError}
                        </div>
                    )}
                </div>
            </div>
            {item.status === 'failed' && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onRetry()
                    }}
                    className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors whitespace-nowrap"
                >
                    Повтор
                </button>
            )}
            {item.status === 'processing' && (
                <span className="flex-shrink-0 text-xs text-blue-600 font-medium whitespace-nowrap">
                    Обработка...
                </span>
            )}
        </div>
    )
}

function mapKindToLabel(kind: string): string {
    const kindMap: Record<string, string> = {
        WORKOUT_SESSION_UPDATE: 'Обновление подхода',
        WORKOUT_SESSION_COMPLETE: 'Завершение тренировки',
        TEMPLATE_CREATE: 'Создание шаблона',
        TEMPLATE_UPDATE: 'Обновление шаблона',
        EXERCISE_ADD: 'Добавление упражнения',
        EXERCISE_UPDATE: 'Обновление упражнения',
        EXERCISE_REMOVE: 'Удаление упражнения',
    }
    return kindMap[kind] || kind
}

function getPayloadPreview(kind: string, payload: Record<string, unknown> | undefined): string {
    if (!payload) return ''

    if (kind.includes('SESSION_UPDATE')) {
        return `Упражнение: ${payload.exerciseIndex || '?'}, Подход: ${payload.setIndex || '?'}`
    }
    if (kind.includes('SESSION_COMPLETE')) {
        const totalSec = payload.totalSeconds as number | undefined
        return `Время: ${totalSec ? Math.floor(totalSec / 60) + 'мин' : '?'}`
    }
    if (kind.includes('TEMPLATE')) {
        return `${payload.name || 'без названия'}`
    }
    return `${Object.keys(payload).slice(0, 2).join(', ')}`
}
