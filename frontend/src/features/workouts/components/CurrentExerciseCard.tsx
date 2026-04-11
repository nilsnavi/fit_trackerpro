import { memo, useMemo } from 'react'
import { CheckCircle2, Settings2, SkipForward, TimerReset } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import type { ActiveWorkoutSyncState } from '@/state/local'
import { FALLBACK_REST_PRESETS_SECONDS } from '@features/workouts/active/lib/activeWorkoutUtils'

interface CurrentExerciseCardProps {
    exerciseName: string
    previousBest: string
    currentSet: string
    remainingSets: number
    syncState: ActiveWorkoutSyncState
    completedSetCount: number
    totalSetCount: number
    restDefaultSeconds: number
    /** Секунды для чипов «Отдых» — совпадают с нижним rail и пресетами шаблона */
    restPresetSeconds?: number[]
    canComplete: boolean
    canSkip: boolean
    onCompleteSet: () => void
    onSkipSet: () => void
    onStartRest: () => void
    onOpenRestPresets: () => void
    onSelectRestPreset?: (seconds: number) => void
}

function formatRemainingSets(remainingSets: number): string {
    const normalized = Math.max(0, remainingSets)
    if (normalized === 1) return 'Остался 1 подход'
    if (normalized >= 2 && normalized <= 4) return `Осталось ${normalized} подхода`
    return `Осталось ${normalized} подходов`
}

/** Цветовая точка + короткий лейбл синхронизации. Скрывается при idle и synced. */
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
            <span className={`h-1.5 w-1.5 rounded-full ${entry.dot}`} />
            <span className="text-[11px] text-telegram-hint">{entry.label}</span>
        </span>
    )
}

function formatRestShort(seconds: number): string {
    return seconds < 60 ? `${seconds}с` : `${Math.floor(seconds / 60)}м`
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
    restPresetSeconds,
    canComplete,
    canSkip,
    onCompleteSet,
    onSkipSet,
    onStartRest,
    onOpenRestPresets,
    onSelectRestPreset,
}: CurrentExerciseCardProps) {
    const progressPercent = totalSetCount > 0 ? Math.round((completedSetCount / totalSetCount) * 100) : 0
    const restChips = useMemo(() => {
        const raw =
            restPresetSeconds != null && restPresetSeconds.length > 0 ? restPresetSeconds : FALLBACK_REST_PRESETS_SECONDS
        return raw.slice(0, 6)
    }, [restPresetSeconds])

    return (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-telegram-hint">Сейчас</p>
                    <h2 className="truncate text-base font-semibold text-telegram-text">{exerciseName}</h2>
                </div>
            </div>

            <div className="rounded-2xl bg-telegram-bg/70 p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-telegram-hint">
                    <span>Прогресс сессии</span>
                    <div className="flex items-center gap-2">
                        <SyncStateDot syncState={syncState} />
                        <span className="font-medium text-telegram-text">{completedSetCount}/{totalSetCount} подходов</span>
                    </div>
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

            {/* Quick Rest Presets */}
            {onSelectRestPreset && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <span className="shrink-0 text-[11px] text-telegram-hint">Отдых:</span>
                    {restChips.map((seconds) => (
                        <button
                            key={`rest-preset-${seconds}`}
                            type="button"
                            onClick={() => onSelectRestPreset(seconds)}
                            className={`min-h-10 shrink-0 touch-manipulation rounded-full px-3 py-2 text-xs font-semibold transition-colors ${restDefaultSeconds === seconds
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-telegram-bg text-telegram-text'
                                }`}
                        >
                            {formatRestShort(seconds)}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onStartRest}
                    leftIcon={<TimerReset className="h-4 w-4" />}
                >
                    Отдых {formatRestShort(restDefaultSeconds)}
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
