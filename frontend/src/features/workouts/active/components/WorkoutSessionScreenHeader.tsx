import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import type { ActiveWorkoutSyncState } from '@/state/local'
import { WorkoutSyncIndicator } from '@features/workouts/active/components/WorkoutSyncIndicator'

export interface WorkoutSessionScreenHeaderProps {
    title: string
    subtitle?: string
    onBack: () => void
    syncState?: ActiveWorkoutSyncState
    pendingCount?: number
    menuOpen: boolean
    onMenuToggle: () => void
    menuContent: ReactNode
}

export function WorkoutSessionScreenHeader({
    title,
    subtitle = 'мини-приложение',
    onBack,
    syncState,
    pendingCount,
    menuOpen,
    onMenuToggle,
    menuContent,
}: WorkoutSessionScreenHeaderProps) {
    return (
        <div className="relative flex items-center justify-between gap-2">
            <button
                type="button"
                onClick={onBack}
                className="shrink-0 text-sm font-semibold text-primary touch-manipulation"
            >
                ‹ Назад
            </button>
            <div className="min-w-0 flex-1 text-center">
                <h1 className="truncate text-base font-bold text-telegram-text">{title}</h1>
                <p className="truncate text-[11px] text-telegram-hint">{subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                {syncState ? <WorkoutSyncIndicator state={syncState} pendingCount={pendingCount} /> : null}
                <div className="relative">
                    <button
                        type="button"
                        onClick={onMenuToggle}
                        className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text"
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        aria-label="Дополнительно"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuOpen ? (
                        <>
                            <button
                                type="button"
                                className="fixed inset-0 z-40 cursor-default bg-transparent"
                                aria-label="Закрыть меню"
                                onClick={onMenuToggle}
                            />
                            <div
                                className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-xl border border-border bg-telegram-bg py-1 shadow-lg"
                                role="menu"
                            >
                                {menuContent}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
