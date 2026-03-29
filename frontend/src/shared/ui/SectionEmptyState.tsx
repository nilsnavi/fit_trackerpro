import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/cn'

export type SectionEmptyStateTone = 'default' | 'telegram'

export interface SectionEmptyStateAction {
    label: string
    onClick: () => void
}

export interface SectionEmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    primaryAction?: SectionEmptyStateAction
    secondaryAction?: SectionEmptyStateAction
    tone?: SectionEmptyStateTone
    className?: string
    compact?: boolean
}

const toneClasses: Record<
    SectionEmptyStateTone,
    { wrap: string; iconBg: string; icon: string; title: string; desc: string; secondaryBtn: string }
> = {
    default: {
        wrap: '',
        iconBg: 'bg-gray-100 dark:bg-neutral-800',
        icon: 'text-gray-400 dark:text-gray-500',
        title: 'text-gray-900 dark:text-white',
        desc: 'text-gray-500 dark:text-gray-400',
        secondaryBtn:
            'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800',
    },
    telegram: {
        wrap: '',
        iconBg: 'bg-telegram-secondary-bg',
        icon: 'text-telegram-hint',
        title: 'text-telegram-text',
        desc: 'text-telegram-hint',
        secondaryBtn: 'text-telegram-text hover:bg-telegram-secondary-bg',
    },
}

export function SectionEmptyState({
    icon: Icon,
    title,
    description,
    primaryAction,
    secondaryAction,
    tone = 'default',
    className,
    compact = false,
}: SectionEmptyStateProps) {
    const t = toneClasses[tone]
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                compact ? 'py-6 px-2' : 'py-10 px-4',
                t.wrap,
                className,
            )}
            role="status"
            aria-live="polite"
        >
            <div
                className={cn(
                    'mb-4 flex items-center justify-center rounded-2xl',
                    compact ? 'h-14 w-14' : 'h-20 w-20',
                    t.iconBg,
                )}
            >
                <Icon className={cn(compact ? 'h-7 w-7' : 'h-10 w-10', t.icon)} strokeWidth={1.75} />
            </div>
            <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base', t.title)}>{title}</p>
            {description ? (
                <p className={cn('mt-1 max-w-sm', compact ? 'text-xs' : 'text-sm', t.desc)}>{description}</p>
            ) : null}
            {(primaryAction || secondaryAction) && (
                <div className={cn('mt-4 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center')}>
                    {primaryAction && (
                        <button
                            type="button"
                            onClick={primaryAction.onClick}
                            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.98]"
                        >
                            {primaryAction.label}
                        </button>
                    )}
                    {secondaryAction && (
                        <button
                            type="button"
                            onClick={secondaryAction.onClick}
                            className={cn(
                                'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                                t.secondaryBtn,
                            )}
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
