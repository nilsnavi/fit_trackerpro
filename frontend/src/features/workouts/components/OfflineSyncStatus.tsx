/**
 * OfflineSyncStatus Component
 * 
 * Индикатор статуса синхронизации при работе офлайн.
 * Показывает количество ожидающих операций и кнопку ручной синхронизации.
 */

import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface OfflineSyncStatusProps {
    queueSize: number
    isSyncing: boolean
    lastSyncTime?: string
    onRetry: () => void
    className?: string
}

export function OfflineSyncStatus({
    queueSize,
    isSyncing,
    lastSyncTime,
    onRetry,
    className,
}: OfflineSyncStatusProps) {
    if (queueSize === 0 && !isSyncing) {
        return null
    }

    return (
        <div
            className={cn(
                'rounded-xl border bg-telegram-secondary-bg p-3',
                queueSize > 0 ? 'border-orange-500/20' : 'border-primary/20',
                className,
            )}
        >
            <div className="flex items-center gap-3">
                {/* Иконка статуса */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {isSyncing ? (
                        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                    ) : queueSize > 0 ? (
                        <WifiOff className="h-5 w-5 text-orange-500" />
                    ) : (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                </div>

                {/* Текст статуса */}
                <div className="flex-1 min-w-0">
                    {isSyncing ? (
                        <>
                            <p className="text-sm font-medium text-telegram-text">
                                Синхронизация...
                            </p>
                            <p className="text-xs text-telegram-hint">
                                Отправляем изменения на сервер
                            </p>
                        </>
                    ) : queueSize > 0 ? (
                        <>
                            <p className="text-sm font-medium text-telegram-text">
                                Ожидает синхронизации
                            </p>
                            <p className="text-xs text-telegram-hint">
                                {queueSize} {queueSize === 1 ? 'операция' : 'операций'} в очереди
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-success">Синхронизировано</p>
                            {lastSyncTime && (
                                <p className="text-xs text-telegram-hint">{lastSyncTime}</p>
                            )}
                        </>
                    )}
                </div>

                {/* Кнопка повторной синхронизации */}
                {queueSize > 0 && !isSyncing && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                    >
                        Повторить
                    </button>
                )}
            </div>
        </div>
    )
}
