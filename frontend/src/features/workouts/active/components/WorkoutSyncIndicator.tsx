import { AlertCircle, CheckCircle2, CloudOff, Loader2 } from 'lucide-react'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface WorkoutSyncIndicatorProps {
    state: ActiveWorkoutSyncState
}

type SyncConfig = {
    icon: React.ReactNode
    text: string
    className: string
}

const SYNC_CONFIG: Partial<Record<ActiveWorkoutSyncState, SyncConfig>> = {
    syncing: {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        text: 'Синхронизация...',
        className: 'text-telegram-hint',
    },
    synced: {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        text: 'Сохранено',
        className: 'text-green-600 dark:text-green-400',
    },
    'offline-queued': {
        icon: <CloudOff className="h-3.5 w-3.5" />,
        text: 'Офлайн — изменения сохранятся локально',
        className: 'text-amber-600 dark:text-amber-400',
    },
    error: {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        text: 'Ошибка синхронизации',
        className: 'text-red-600 dark:text-red-400',
    },
}

/**
 * Displays a compact sync status row.
 * Returns null for the `idle` state to avoid visual noise during normal use.
 */
export function WorkoutSyncIndicator({ state }: WorkoutSyncIndicatorProps) {
    const config = SYNC_CONFIG[state]
    if (!config) return null

    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`flex items-center gap-1.5 text-xs ${config.className}`}
        >
            {config.icon}
            <span>{config.text}</span>
        </div>
    )
}
