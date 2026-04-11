import { type ReactNode, useRef, useState } from 'react'
import { cn } from '@shared/lib/cn'

/** Visible strip when collapsed — ~44px for comfortable thumb hit area on the drag handle. */
const HANDLE_VISIBLE_PX = 44

export interface StickyBottomBarProps {
    children: ReactNode
    className?: string
    /**
     * When true (default) the bar sits above the bottom navigation bar
     * (~56 px + env(safe-area-inset-bottom)).
     * Pass false when the page deliberately hides the nav bar.
     */
    aboveNav?: boolean
    /**
     * When true the bar can be swiped up to reveal its content and swiped
     * down to collapse back to a thin handle strip.
     */
    collapsible?: boolean
    /**
     * Initial collapsed state. Only used when collapsible=true.
     * Defaults to true (starts hidden, appears on swipe-up).
     */
    defaultCollapsed?: boolean
}

/**
 * StickyBottomBar — fixed footer bar for primary CTAs (e.g. "Save", "Start
 * workout"). Stays above the bottom navigation and respects iOS safe areas.
 *
 * When `collapsible` is true the bar can start collapsed (thin strip) or
 * expanded (`defaultCollapsed`) and toggles via swipe or handle tap.
 *
 * @example
 * <StickyBottomBar>
 *   <Button className="flex-1">Начать тренировку</Button>
 * </StickyBottomBar>
 */
export function StickyBottomBar({
    children,
    aboveNav = true,
    collapsible = false,
    defaultCollapsed = true,
    className,
}: StickyBottomBarProps) {
    const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false)
    const touchStartY = useRef<number | null>(null)

    const aboveNavClass = aboveNav ? 'mb-[var(--app-shell-nav-h)]' : ''
    const pbClass = aboveNav
        ? 'pb-3'
        : 'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]'

    if (!collapsible) {
        return (
            <div
                className={cn(
                    /* z-40: above FloatingRestTimer (z-30); keep below bottom nav (z-50) */
                    'fixed inset-x-0 bottom-0 z-40',
                    'border-t border-border bg-telegram-bg/90 backdrop-blur-sm',
                    'px-4 py-3',
                    aboveNav
                        ? 'mb-[var(--app-shell-nav-h)] pb-3'
                        : 'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
                    className,
                )}
            >
                {children}
            </div>
        )
    }

    function onTouchStart(e: React.TouchEvent) {
        touchStartY.current = e.touches[0].clientY
    }

    function onTouchEnd(e: React.TouchEvent) {
        if (touchStartY.current === null) return
        const dy = touchStartY.current - e.changedTouches[0].clientY
        if (dy > 20) setCollapsed(false)       // swipe up  → expand
        else if (dy < -20) setCollapsed(true)  // swipe down → collapse
        touchStartY.current = null
    }

    return (
        <div
            className={cn(
                'fixed inset-x-0 bottom-0 z-40',
                'border-t border-border bg-telegram-bg/90 backdrop-blur-sm',
                aboveNavClass,
            )}
            style={{
                transform: collapsed
                    ? `translateY(calc(100% - ${HANDLE_VISIBLE_PX}px))`
                    : 'translateY(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Drag handle — always visible, tap to toggle */}
            <button
                type="button"
                className="flex w-full min-h-11 items-center justify-center select-none touch-manipulation"
                style={{ height: HANDLE_VISIBLE_PX }}
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? 'Показать панель управления' : 'Скрыть панель управления'}
            >
                <div className="w-10 h-1 rounded-full bg-telegram-hint/40" />
            </button>

            {/* Collapsible content */}
            <div className={cn('px-4', pbClass, className)}>
                {children}
            </div>
        </div>
    )
}
