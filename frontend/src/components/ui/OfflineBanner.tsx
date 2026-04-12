export type OfflineBannerVariant = 'offline' | 'online-syncing' | 'online-saved'

export interface OfflineBannerProps {
    variant: OfflineBannerVariant
    className?: string
}

/**
 * Неблокирующий баннер сети (не модальное окно): фиксированный стиль под Telegram-тему.
 */
export function OfflineBanner({ variant, className = '' }: OfflineBannerProps) {
    const base =
        'pointer-events-none sticky top-0 z-40 mx-auto w-full max-w-lg px-3 pt-2 ' +
        '[padding-top:max(0.5rem,env(safe-area-inset-top))]'

    if (variant === 'offline') {
        return (
            <div
                role="status"
                aria-live="polite"
                className={`${base} ${className}`.trim()}
            >
                <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-center text-sm font-medium text-telegram-text shadow-sm">
                    Нет соединения — данные сохраняются локально
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
