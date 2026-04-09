import { memo } from 'react'
import { CheckCircle2, Settings2, SkipForward, TimerReset } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface CurrentExerciseCardProps {
    exerciseName: string
    previousBest: string
    currentSet: string
    remainingSets: number
    syncState: ActiveWorkoutSyncState
    completedSetCount: number
    totalSetCount: number
    restDefaultSeconds: number
    canComplete: boolean
    canSkip: boolean
    onCompleteSet: () => void
    onSkipSet: () => void
    onStartRest: () => void
    onOpenRestPresets: () => void
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
    completedSetCount,
    totalSetCount,
    restDefaultSeconds,
    canComplete,
    canSkip,
    onCompleteSet,
    onSkipSet,
    onStartRest,
    onOpenRestPresets,
}: CurrentExerciseCardProps) {
    const progressPercent = totalSetCount > 0 ? Math.round((completedSetCount / totalSetCount) * 100) : 0

    return (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-telegram-hint">Сейчас</p>
                    <h2 className="truncate text-base font-semibold text-telegram-text">{exerciseName}</h2>
                </div>
                <span className="rounded-full bg-telegram-bg px-2 py-1 text-xs text-telegram-hint">
                    {formatSyncState(syncState)}
                </span>
            </div>

            <div className="rounded-2xl bg-telegram-bg/70 p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-telegram-hint">
                    <span>Прогресс сессии</span>
                    <span className="font-medium text-telegram-text">{completedSetCount}/{totalSetCount} подходов</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-telegram-secondary-bg">
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                </div>
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

            <div className="grid grid-cols-2 gap-2">
                <Button
                    type="button"
                    onClick={onCompleteSet}
                    disabled={!canComplete}
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                >
                    Готово
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onSkipSet}
                    disabled={!canSkip}
                    leftIcon={<SkipForward className="h-4 w-4" />}
                >
                    Пропуск
                </Button>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onStartRest}
                    leftIcon={<TimerReset className="h-4 w-4" />}
                >
                    Отдых {restDefaultSeconds < 60 ? `${restDefaultSeconds}с` : `${Math.floor(restDefaultSeconds / 60)}м`}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onOpenRestPresets}
                    leftIcon={<Settings2 className="h-4 w-4" />}
                >
                    Пресеты
                </Button>
            </div>
        </section>
    )
})

CurrentExerciseCard.displayName = 'CurrentExerciseCard'
