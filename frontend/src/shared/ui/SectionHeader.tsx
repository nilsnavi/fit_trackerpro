import type { ReactNode } from 'react'
import { cn } from '@shared/lib/cn'

interface SectionHeaderProps {
    title: string
    description?: string
    action?: ReactNode
    className?: string
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
    return (
        <div className={cn('flex items-start justify-between gap-3', className)}>
            <div className="min-w-0">
                <h2 className="text-base font-semibold text-telegram-text">{title}</h2>
                {description ? (
                    <p className="mt-1 text-xs leading-5 text-telegram-hint">{description}</p>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}