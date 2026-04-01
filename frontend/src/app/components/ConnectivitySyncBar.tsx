import type { ReactNode } from 'react'
import { Loader2, UploadCloud, WifiOff } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useNetworkOnline } from '@shared/hooks/useNetworkOnline'
import { useSyncQueueUiState } from '@shared/hooks/useSyncQueueUiState'

/**
 * Полоса под шапкой: офлайн и статус синхронизации очереди мутаций.
 */
export function ConnectivitySyncBar() {
    const online = useNetworkOnline()
    const { queuedCount, failedCount, isFlushing, retryInSec } = useSyncQueueUiState()

    const showBar = !online || queuedCount > 0 || failedCount > 0 || isFlushing

    if (!showBar) return null

    let icon: ReactNode
    let title: string
    let subtitle: string | null = null
    let surfaceClass: string

    if (!online) {
        icon = <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        title = 'Нет сети'
        subtitle =
            queuedCount > 0
                ? `Изменения сохранены локально. В очереди на отправку: ${queuedCount}.`
                : 'Данные из кэша; новые запросы к серверу недоступны.'
        surfaceClass =
            'border-amber-500/35 bg-amber-500/12 text-amber-950 dark:text-amber-100'
    } else if (isFlushing) {
        icon = (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        )
        title = 'Синхронизация с сервером…'
        subtitle =
            queuedCount > 0
                ? `Отправка изменений (осталось в очереди: ${queuedCount}).`
                : null
        surfaceClass =
            'border-primary-500/30 bg-primary-500/10 text-telegram-text'
    } else if (queuedCount > 0) {
        icon = <UploadCloud className="h-4 w-4 shrink-0" aria-hidden />
        if (retryInSec > 0) {
            title = 'Ожидание повтора отправки'
            subtitle = `Следующая попытка через ${retryInSec} с. В очереди: ${queuedCount}.`
        } else {
            title = 'Изменения ждут отправки'
            subtitle = `В очереди: ${queuedCount} ${pluralOps(queuedCount)}.`
        }
        surfaceClass =
            'border-border bg-telegram-secondary-bg/80 text-telegram-text'
    } else if (failedCount > 0) {
        icon = <UploadCloud className="h-4 w-4 shrink-0" aria-hidden />
        title = 'Не удалось синхронизировать изменения'
        subtitle = `Требуется внимание: ${failedCount} ${pluralOps(failedCount)} не отправлены.`
        surfaceClass =
            'border-rose-500/35 bg-rose-500/12 text-rose-950 dark:text-rose-100'
    } else {
        return null
    }

    return (
        <div
            className={cn(
                'border-b px-3 py-2.5 text-sm leading-snug',
                surfaceClass,
            )}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-current opacity-90">{icon}</span>
                <div className="min-w-0 flex-1">
                    <p className="font-medium">{title}</p>
                    {subtitle ? (
                        <p className="mt-0.5 text-xs opacity-85">{subtitle}</p>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function pluralOps(n: number): string {
    const m10 = n % 10
    const m100 = n % 100
    if (m100 >= 11 && m100 <= 14) return 'операций'
    if (m10 === 1) return 'операция'
    if (m10 >= 2 && m10 <= 4) return 'операции'
    return 'операций'
}
