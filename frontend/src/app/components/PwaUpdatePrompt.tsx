import { useRegisterSW } from 'virtual:pwa-register/react'
import { cn } from '@shared/lib/cn'
import { useEffect } from 'react'

/**
 * Prompt-based PWA update: new service worker stays in "waiting" until the user
 * applies it, avoiding mixed old/new asset loads in one session. Also surfaces a
 * one-off "ready to work offline" notice after the first successful install.
 */
export function PwaUpdatePrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        offlineReady: [offlineReady, setOfflineReady],
        updateServiceWorker,
    } = useRegisterSW({
        immediate: true,
    })

    // В Telegram Mini App пользователи часто не видят промпт обновления.
    // Автоприменяем свежий SW, чтобы не застревать на старых ассетах/теме/локализации.
    useEffect(() => {
        if (!needRefresh) return
        const isTelegram = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp)
        if (!isTelegram) return
        void updateServiceWorker(true)
    }, [needRefresh, updateServiceWorker])

    // «Готово к офлайну» — разовое уведомление: авто-скрытие, чтобы не висеть.
    useEffect(() => {
        if (!offlineReady) return
        const timer = window.setTimeout(() => setOfflineReady(false), 4000)
        return () => window.clearTimeout(timer)
    }, [offlineReady, setOfflineReady])

    if (!needRefresh && !offlineReady) {
        return null
    }

    const isUpdate = needRefresh

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'fixed left-0 right-0 z-[55] border-t border-border bg-telegram-bg/95 backdrop-blur-sm',
                'safe-area-x shadow-[0_-4px_24px_rgba(0,0,0,0.16)]',
                'bottom-[calc(var(--app-shell-nav-h)+env(safe-area-inset-bottom,0px))]',
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <p className="min-w-0 flex-1 text-telegram-text">
                    {isUpdate
                        ? 'Доступна новая версия приложения.'
                        : 'Приложение готово к работе офлайн.'}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                    {isUpdate ? (
                        <>
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
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setOfflineReady(false)}
                            className="rounded-lg border border-border px-3 py-1.5 font-medium text-telegram-text transition-colors hover:bg-muted/50"
                        >
                            Понятно
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
