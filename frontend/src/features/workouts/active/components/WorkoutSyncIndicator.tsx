import { memo } from 'react'
import { AlertCircle, CheckCircle2, CloudOff, Loader2 } from 'lucide-react'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface WorkoutSyncIndicatorProps {
    state: ActiveWorkoutSyncState | WorkoutSyncIndicatorState
}

export type WorkoutSyncIndicatorState = 'syncing' | 'synced' | 'offline' | 'error'

type SyncConfig = {
    icon: React.ReactNode
    text: string
    className: string
}

const SYNC_CONFIG: Record<WorkoutSyncIndicatorState, SyncConfig> = {
    syncing: {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Синхронизация',
        className: 'text-telegram-hint bg-telegram-secondary-bg/80',
    },
    synced: {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        text: 'Сохранено',
        className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30',
    },
    offline: {
        icon: <CloudOff className="h-3.5 w-3.5" />,
        text: 'Офлайн',
        className: 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30',
    },
    error: {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        text: 'Ошибка',
        className: 'text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-950/30',
    },
}

function normalizeState(
    state: ActiveWorkoutSyncState | WorkoutSyncIndicatorState,
): WorkoutSyncIndicatorState | null {
    if (state === 'offline-queued') return 'offline'
    if (state === 'idle') return null
    if (state === 'offline') return 'offline'
    return state
}

/**
 * Displays sync status indicator.
 * Shows syncing, synced, offline-queued, or error states.
 * Returns null for `idle` state to avoid visual noise during normal use.
 */
export const WorkoutSyncIndicator = memo(function WorkoutSyncIndicator({ state }: WorkoutSyncIndicatorProps) {
    const normalizedState = normalizeState(state)
    if (!normalizedState) return null

    const config = SYNC_CONFIG[normalizedState]
    if (!config) return null

    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${config.className}`}
        >
            {config.icon}
            <span className="leading-none">{config.text}</span>
        </div>
    )
})

WorkoutSyncIndicator.displayName = 'WorkoutSyncIndicator'
