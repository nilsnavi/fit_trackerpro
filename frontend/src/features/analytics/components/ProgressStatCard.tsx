import { cn } from '@shared/lib/cn'
import type { LucideIcon } from 'lucide-react'

interface ProgressStatCardProps {
    label: string
    value: string
    hint?: string
    icon: LucideIcon
    tone?: 'default' | 'success' | 'warning'
}

export function ProgressStatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone = 'default',
}: ProgressStatCardProps) {
    return (
        <article className="rounded-2xl bg-telegram-secondary-bg p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-telegram-hint">{label}</p>
                <span
                    className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full',
                        tone === 'default' && 'bg-telegram-bg text-telegram-hint',
                        tone === 'success' && 'bg-success/15 text-success',
                        tone === 'warning' && 'bg-warning/15 text-warning',
                    )}
                >
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <p className="mt-2 text-xl font-semibold leading-none text-telegram-text">{value}</p>
            {hint ? <p className="mt-1 text-xs text-telegram-hint">{hint}</p> : null}
        </article>
    )
}
