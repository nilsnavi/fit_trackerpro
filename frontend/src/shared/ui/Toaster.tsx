import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, RefreshCw, UploadCloud, X } from 'lucide-react'
import { useToastStore } from '@shared/stores/toastStore'
import type { ToastKind } from '@shared/stores/toastStore'

const DEFAULT_DURATION_MS = 3500

const KIND_CONFIG: Record<ToastKind, { icon: React.ReactNode; className: string }> = {
    success: {
        icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
        className: 'bg-green-600 text-white',
    },
    error: {
        icon: <AlertCircle className="h-4 w-4 shrink-0" />,
        className: 'bg-danger text-white',
    },
    info: {
        icon: <Info className="h-4 w-4 shrink-0" />,
        className: 'bg-telegram-secondary-bg text-telegram-text border border-border',
    },
    retry: {
        icon: <RefreshCw className="h-4 w-4 shrink-0" />,
        className: 'bg-amber-500 text-white',
    },
    sync: {
        icon: <UploadCloud className="h-4 w-4 shrink-0" />,
        className: 'bg-primary-600 text-white',
    },
}

function ToastItem({
    id,
    kind,
    message,
    duration,
    action,
}: {
    id: string
    kind: ToastKind
    message: string
    duration?: number
    action?: {
        label: string
        onClick: () => void
    }
}) {
    const dismiss = useToastStore((s) => s.dismiss)
    const ms = duration === 0 ? null : (duration ?? DEFAULT_DURATION_MS)

    useEffect(() => {
        if (ms === null) return
        const timer = window.setTimeout(() => dismiss(id), ms)
        return () => window.clearTimeout(timer)
    }, [id, ms, dismiss])

    const { icon, className } = KIND_CONFIG[kind]

    return (
        <div
            role="alert"
            aria-live="assertive"
            className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 fade-in-0 duration-200 ${className}`}
        >
            {icon}
            <span className="flex-1">{message}</span>
            {action ? (
                <button
                    type="button"
                    className="rounded-md border border-white/30 px-2 py-0.5 text-xs font-semibold text-white hover:bg-white/10"
                    onClick={() => {
                        action.onClick()
                        dismiss(id)
                    }}
                >
                    {action.label}
                </button>
            ) : null}
            <button
                type="button"
                aria-label="Закрыть уведомление"
                className="ml-1 opacity-70 hover:opacity-100"
                onClick={() => dismiss(id)}
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}

/**
 * Mount once near the root, outside of any scrolling container.
 * Uses a portal so z-index is always on top.
 */
export function Toaster() {
    const toasts = useToastStore((s) => s.toasts)

    if (toasts.length === 0) return null

    return createPortal(
        <div
            aria-label="Уведомления"
            className="fixed bottom-20 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none"
        >
            {toasts.map((t) => (
                <div key={t.id} className="w-full max-w-sm pointer-events-auto">
                    <ToastItem {...t} />
                </div>
            ))}
        </div>,
        document.body,
    )
}
