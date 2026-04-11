import { memo, useMemo } from 'react'
import { Timer } from 'lucide-react'
import type { ActiveWorkoutSyncState } from '@/state/local'

function SyncStateDot({ syncState }: { syncState: ActiveWorkoutSyncState }) {
    if (syncState === 'idle' || syncState === 'synced') return null

    const config: Record<string, { dot: string; label: string }> = {
        'saved-locally': { dot: 'bg-blue-500', label: 'Сохраняется...' },
        syncing: { dot: 'bg-blue-500 animate-pulse', label: 'Синк...' },
        error: { dot: 'bg-danger', label: 'Ошибка' },
        'offline-queued': { dot: 'bg-warning', label: 'Офлайн' },
        conflict: { dot: 'bg-danger', label: 'Конфликт' },
    }

    const entry = config[syncState] ?? { dot: 'bg-telegram-hint', label: 'Локально' }
    return (
        <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.dot}`} />
            <span className="text-[11px] text-telegram-hint">{entry.label}</span>
        </span>
    )
}

function formatRestShort(seconds: number): string {
    return seconds < 60 ? `${seconds} с` : `${Math.floor(seconds / 60)} мин`
}

export interface ActiveWorkoutSessionBarProps {
    workoutTitle: string
    elapsedLabel: string
    completedSetCount: number
    totalSetCount: number
    syncState: ActiveWorkoutSyncState
    isActiveDraft: boolean
    restDefaultSeconds: number
    onStartRest: () => void
}

/**
 * Компактная строка: название сессии, таймер, прогресс — без дублирования карточки «Сейчас».
 */
export const ActiveWorkoutSessionBar = memo(function ActiveWorkoutSessionBar({
    workoutTitle,
    elapsedLabel,
    completedSetCount,
    totalSetCount,
    syncState,
    isActiveDraft,
    restDefaultSeconds,
    onStartRest,
}: ActiveWorkoutSessionBarProps) {
    const progressPercent = totalSetCount > 0 ? Math.round((completedSetCount / totalSetCount) * 100) : 0
    const restLabel = useMemo(() => formatRestShort(restDefaultSeconds), [restDefaultSeconds])

    return (
        <section className="rounded-2xl border border-border bg-telegram-secondary-bg p-3" data-testid="active-workout-session-bar">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Сессия</p>
                    <h2 className="line-clamp-2 text-base font-semibold leading-tight text-telegram-text">{workoutTitle}</h2>
                </div>
                <div className="shrink-0 rounded-xl bg-telegram-bg/80 px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-telegram-hint">Прошло</p>
                    <p className="text-lg font-bold tabular-nums text-telegram-text">{elapsedLabel}</p>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-telegram-hint">
                <SyncStateDot syncState={syncState} />
                <span className="font-medium text-telegram-text">
                    {completedSetCount}/{totalSetCount} подходов
                </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-telegram-bg">
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
            </div>
            {isActiveDraft ? (
                <button
                    type="button"
                    onClick={onStartRest}
                    className="mt-3 flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-border bg-telegram-bg px-4 py-2.5 text-sm font-semibold text-telegram-text active:bg-telegram-secondary-bg"
                >
                    <Timer className="h-5 w-5 shrink-0 text-primary" />
                    Старт отдыха · {restLabel}
                </button>
            ) : null}
        </section>
    )
})

ActiveWorkoutSessionBar.displayName = 'ActiveWorkoutSessionBar'
