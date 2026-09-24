import { memo, useEffect, useState } from 'react'
import { Check, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@shared/lib/cn'

export type CompletionStatus = 'progress' | 'same' | 'regress' | 'unknown'

export interface SetCompletionFeedbackProps {
    /** Показывать ли feedback */
    show: boolean
    /** Статус завершения (прогресс/регресс/так же) */
    status: CompletionStatus
    /** Автоскрытие через мс (0 = не скрывать) */
    autoHideMs?: number
    /** Callback при скрытии */
    onDismiss?: () => void
    /** Дополнительные классы */
    className?: string
}

/**
 * Визуальный feedback при завершении подхода.
 * Показывает анимацию с индикацией прогресса.
 */
export const SetCompletionFeedback = memo(function SetCompletionFeedback({
    show,
    status,
    autoHideMs = 2000,
    onDismiss,
    className,
}: SetCompletionFeedbackProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (show) {
            setIsVisible(true)
            if (autoHideMs > 0) {
                const timer = setTimeout(() => {
                    setIsVisible(false)
                    onDismiss?.()
                }, autoHideMs)
                return () => clearTimeout(timer)
            }
        } else {
            setIsVisible(false)
        }
        return undefined
    }, [show, autoHideMs, onDismiss])

    if (!isVisible) return null

    const statusConfig = {
        progress: {
            icon: TrendingUp,
            label: 'Новый рекорд!',
            bgClass: 'bg-emerald-500/20 border-emerald-500/30',
            textClass: 'text-emerald-500',
            iconClass: 'text-emerald-500',
        },
        same: {
            icon: Minus,
            label: 'Повторение результата',
            bgClass: 'bg-telegram-secondary-bg border-telegram-hint/20',
            textClass: 'text-telegram-text',
            iconClass: 'text-telegram-hint',
        },
        regress: {
            icon: TrendingDown,
            label: 'Чуть меньше нормы',
            bgClass: 'bg-orange-500/20 border-orange-500/30',
            textClass: 'text-orange-500',
            iconClass: 'text-orange-500',
        },
        unknown: {
            icon: Check,
            label: 'Подход завершён',
            bgClass: 'bg-primary/20 border-primary/30',
            textClass: 'text-primary',
            iconClass: 'text-primary',
        },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <div
            className={cn(
                'fixed inset-x-4 top-20 z-50 animate-slide-down',
                className,
            )}
        >
            <div
                className={cn(
                    'flex items-center justify-between rounded-xl border p-4 shadow-lg',
                    config.bgClass,
                )}
            >
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            config.iconClass,
                        )}
                    >
                        <Icon className="h-6 w-6" />
                    </div>
                    <span className={cn('font-semibold', config.textClass)}>
                        {config.label}
                    </span>
                </div>
                {onDismiss && (
                    <button
                        type="button"
                        onClick={() => {
                            setIsVisible(false)
                            onDismiss()
                        }}
                        className="rounded-full p-1.5 text-telegram-hint transition-colors hover:bg-telegram-bg/50 hover:text-telegram-text"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    )
})

/**
 * Inline мини-версия feedback для использования внутри карточки.
 */
export const SetCompletionFeedbackInline = memo(function SetCompletionFeedbackInline({
    status,
    className,
}: {
    status: CompletionStatus
    className?: string
}) {
    const statusConfig = {
        progress: { icon: TrendingUp, class: 'text-emerald-500 bg-emerald-500/10' },
        same: { icon: Minus, class: 'text-telegram-hint bg-telegram-secondary-bg' },
        regress: { icon: TrendingDown, class: 'text-orange-500 bg-orange-500/10' },
        unknown: { icon: Check, class: 'text-primary bg-primary/10' },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <div
            className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                config.class,
                className,
            )}
        >
            <Icon className="h-3.5 w-3.5" />
        </div>
    )
})
