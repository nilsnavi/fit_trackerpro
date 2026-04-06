import type { ReactNode } from 'react'
import { cn } from '@shared/lib/cn'

export interface StickyBottomBarProps {
    children: ReactNode
    className?: string
    /**
     * When true (default) the bar sits above the bottom navigation bar
     * (~56 px + env(safe-area-inset-bottom)).
     * Pass false when the page deliberately hides the nav bar.
     */
    aboveNav?: boolean
}

/**
 * StickyBottomBar — fixed footer bar for primary CTAs (e.g. "Save", "Start
 * workout"). Stays above the bottom navigation and respects iOS safe areas.
 *
 * @example
 * <StickyBottomBar>
 *   <Button className="flex-1">Начать тренировку</Button>
 * </StickyBottomBar>
 */
export function StickyBottomBar({
    children,
    aboveNav = true,
    className,
}: StickyBottomBarProps) {
    return (
        <div
            className={cn(
                'fixed inset-x-0 bottom-0 z-30',
                'border-t border-border bg-telegram-bg/90 backdrop-blur-sm',
                'px-4 py-3',
                aboveNav ? 'mb-[var(--app-shell-nav-h)] pb-3' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
                className,
            )}
        >
            {children}
        </div>
    )
}
