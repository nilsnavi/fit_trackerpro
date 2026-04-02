import type { ReactNode } from 'react'
import { cn } from '@shared/lib/cn'

const spacingClass = {
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
} as const

export interface PageSectionProps {
    /** Optional heading shown above the section body */
    title?: string
    /** Optional element rendered to the right of the heading */
    titleRight?: ReactNode
    children: ReactNode
    className?: string
    /** Gap between children (default: 'md') */
    spacing?: keyof typeof spacingClass
}

/**
 * PageSection — a titled content block used to divide a page into logical
 * areas. Renders a `<section>` with an optional sticky header row.
 *
 * @example
 * <PageSection title="История" titleRight={<FilterButton />} spacing="sm">
 *   {items.map(…)}
 * </PageSection>
 */
export function PageSection({
    title,
    titleRight,
    children,
    spacing = 'md',
    className,
}: PageSectionProps) {
    return (
        <section className={cn(spacingClass[spacing], className)}>
            {(title || titleRight) && (
                <header className="flex items-center justify-between gap-3">
                    {title && (
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-telegram-hint">
                            {title}
                        </h2>
                    )}
                    {titleRight && <div className="shrink-0">{titleRight}</div>}
                </header>
            )}
            {children}
        </section>
    )
}
