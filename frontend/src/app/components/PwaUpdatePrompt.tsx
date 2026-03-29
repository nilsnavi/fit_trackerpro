import { useRegisterSW } from 'virtual:pwa-register/react'
import { cn } from '@shared/lib/cn'

/**
 * Prompt-based PWA update: new service worker stays in "waiting" until the user
 * applies it, avoiding mixed old/new asset loads in one session.
 */
export function PwaUpdatePrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        immediate: true,
    })

    if (!needRefresh) {
        return null
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'fixed left-0 right-0 z-[55] border-t border-border bg-telegram-bg/95 backdrop-blur-sm',
                'safe-area-x shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]',
                'bottom-[calc(var(--app-shell-nav-h)+env(safe-area-inset-bottom,0px))]',
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <p className="min-w-0 flex-1 text-telegram-text">Доступна новая версия приложения.</p>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setNeedRefresh(false)}
                        className="rounded-lg border border-border px-3 py-1.5 font-medium text-telegram-text transition-colors hover:bg-muted/50"
                    >
                        Позже
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void updateServiceWorker(true)
                        }}
                        className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        Обновить
                    </button>
                </div>
            </div>
        </div>
    )
}
