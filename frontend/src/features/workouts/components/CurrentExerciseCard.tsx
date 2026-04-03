import { memo } from 'react'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface CurrentExerciseCardProps {
    exerciseName: string
    previousBest: string
    currentSet: string
    remainingSets: number
    syncState: ActiveWorkoutSyncState
}

function formatRemainingSets(remainingSets: number): string {
    const normalized = Math.max(0, remainingSets)
    if (normalized === 1) return 'Остался 1 подход'
    if (normalized >= 2 && normalized <= 4) return `Осталось ${normalized} подхода`
    return `Осталось ${normalized} подходов`
}

function formatSyncState(syncState: ActiveWorkoutSyncState): string {
    if (syncState === 'syncing') return 'Синхронизация...'
    if (syncState === 'error') return 'Ошибка синхронизации'
    if (syncState === 'synced') return 'Сохранено'
    if (syncState === 'offline-queued') return 'Офлайн'
    return 'Локально'
}

export const CurrentExerciseCard = memo(function CurrentExerciseCard({
    exerciseName,
    previousBest,
    currentSet,
    remainingSets,
    syncState,
}: CurrentExerciseCardProps) {
    return (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-telegram-hint">Сейчас</p>
                    <h2 className="truncate text-base font-semibold text-telegram-text">{exerciseName}</h2>
                </div>
                <span className="rounded-full bg-telegram-bg px-2 py-1 text-xs text-telegram-hint">
                    {formatSyncState(syncState)}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-telegram-bg/70 p-2">
                    <p className="text-[11px] text-telegram-hint">Прошлый лучший</p>
                    <p className="mt-1 text-sm font-medium text-telegram-text">{previousBest}</p>
                </div>
                <div className="rounded-lg bg-telegram-bg/70 p-2">
                    <p className="text-[11px] text-telegram-hint">Текущий подход</p>
                    <p className="mt-1 text-sm font-medium text-telegram-text">{currentSet}</p>
                </div>
                <div className="rounded-lg bg-telegram-bg/70 p-2">
                    <p className="text-[11px] text-telegram-hint">Оставшиеся</p>
                    <p className="mt-1 text-sm font-medium text-telegram-text">{formatRemainingSets(remainingSets)}</p>
                </div>
            </div>
        </section>
    )
})

CurrentExerciseCard.displayName = 'CurrentExerciseCard'
