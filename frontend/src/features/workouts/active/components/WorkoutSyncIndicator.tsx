import { memo } from 'react'
import { AlertCircle, CheckCircle2, CloudOff, Loader2 } from 'lucide-react'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface WorkoutSyncIndicatorProps {
    state: ActiveWorkoutSyncState
}

type SyncConfig = {
    icon: React.ReactNode
    text: string
    hint?: string
    iconClassName: string
    textClassName: string
    containerClassName: string
}

const SYNC_CONFIG: Partial<Record<ActiveWorkoutSyncState, SyncConfig>> = {
    syncing: {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Синхронизация...',
        iconClassName: 'text-telegram-hint',
        textClassName: 'text-telegram-text',
        containerClassName: 'bg-transparent',
    },
    synced: {
        icon: <CheckCircle2 className="h-4 w-4" />,
        text: 'Сохранено',
        iconClassName: 'text-green-600 dark:text-green-400',
        textClassName: 'text-green-600 dark:text-green-400',
        containerClassName: 'bg-transparent',
    },
    'offline-queued': {
        icon: <CloudOff className="h-4 w-4" />,
        text: 'Офлайн',
        hint: 'Изменения будут отправлены при подключении',
        iconClassName: 'text-amber-600 dark:text-amber-400',
        textClassName: 'text-amber-600 dark:text-amber-400',
        containerClassName: 'bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/50',
    },
    error: {
        icon: <AlertCircle className="h-4 w-4" />,
        text: 'Ошибка синхронизации',
        hint: 'Автоматический повтор в процессе',
        iconClassName: 'text-red-600 dark:text-red-400',
        textClassName: 'text-red-600 dark:text-red-400',
        containerClassName: 'bg-red-50/70 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/50',
    },
}

/**
 * Displays sync status indicator.
 * Shows syncing, synced, offline-queued, or error states.
 * Returns null for `idle` state to avoid visual noise during normal use.
 */
export const WorkoutSyncIndicator = memo(function WorkoutSyncIndicator({ state }: WorkoutSyncIndicatorProps) {
    const config = SYNC_CONFIG[state]
    if (!config) return null

    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`rounded-lg px-3 py-2 flex items-center gap-2 text-sm ${config.containerClassName}`}
        >
            <div className={config.iconClassName}>{config.icon}</div>
            <div className="flex flex-col gap-0.5">
                <span className={`font-medium ${config.textClassName}`}>{config.text}</span>
                {config.hint && (
                    <span className={`text-xs opacity-80 ${config.textClassName}`}>{config.hint}</span>
                )}
            </div>
        </div>
    )
})

WorkoutSyncIndicator.displayName = 'WorkoutSyncIndicator'
