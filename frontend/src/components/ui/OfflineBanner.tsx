export type OfflineBannerVariant = 'offline' | 'online-syncing' | 'online-saved'

export interface OfflineBannerProps {
    variant: OfflineBannerVariant
    /** Для `offline`: сколько подходов в очереди `offline_workout_queue` */
    offlineSetCount?: number
    className?: string
}

function formatSetsQueuedLabel(count: number): string {
    const n = Math.abs(Math.floor(count))
    const mod100 = n % 100
    const mod10 = n % 10
    if (mod100 > 10 && mod100 < 20) {
        return `${n} сетов`
    }
    if (mod10 === 1) {
        return `${n} сет`
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return `${n} сета`
    }
    return `${n} сетов`
}

/**
 * Неблокирующий баннер сети (не модальное окно): фиксированный стиль под Telegram-тему.
 */
export function OfflineBanner({ variant, offlineSetCount = 0, className = '' }: OfflineBannerProps) {
    const base =
        'pointer-events-none sticky top-0 z-40 mx-auto w-full max-w-lg px-3 pt-2 ' +
        '[padding-top:max(0.5rem,env(safe-area-inset-top))]'

    if (variant === 'offline') {
        const detail =
            offlineSetCount > 0
                ? ` · ${formatSetsQueuedLabel(offlineSetCount)} сохранено локально`
                : ' — данные сохранены локально'
        return (
            <div
                role="status"
                aria-live="polite"
                className={`${base} ${className}`.trim()}
            >
                <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-center text-sm font-medium text-telegram-text shadow-sm">
                    Нет соединения{detail}
                </div>
            </div>
        )
    }

    if (variant === 'online-syncing') {
        return (
            <div
                role="status"
                aria-live="polite"
                className={`${base} ${className}`.trim()}
            >
                <div className="rounded-lg border border-border bg-telegram-secondary-bg px-3 py-2 text-center text-sm font-medium text-telegram-text shadow-sm">
                    Синхронизация...
                </div>
            </div>
        )
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={`${base} ${className}`.trim()}
        >
            <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-center text-sm font-medium text-telegram-text shadow-sm">
                Данные сохранены ✓
            </div>
        </div>
    )
}
