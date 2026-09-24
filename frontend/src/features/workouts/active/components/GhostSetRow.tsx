import { memo } from 'react'
import { Timer, Weight } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { GhostModeSetData } from '../hooks/useGhostModeData'

export interface GhostSetRowProps {
    /** Данные предыдущего выполнения */
    ghost: GhostModeSetData
    /** Тип упражнения */
    exerciseType?: 'strength' | 'cardio' | 'time-based' | 'unknown'
    /** Компактный режим */
    compact?: boolean
    /** Дополнительные классы */
    className?: string
}

/**
 * Строка отображения Ghost Mode — предыдущие показатели подхода.
 */
export const GhostSetRow = memo(function GhostSetRow({
    ghost,
    exerciseType = 'strength',
    compact = false,
    className,
}: GhostSetRowProps) {
    const formatWeight = (weight?: number) => {
        if (weight == null) return null
        return `${weight} кг`
    }

    const formatReps = (reps?: number) => {
        if (reps == null) return null
        return `${reps} reps`
    }

    const formatDuration = (seconds?: number) => {
        if (seconds == null) return null
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        if (mins > 0) {
            return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins} мин`
        }
        return `${secs} сек`
    }

    const formatRest = (restSeconds?: number) => {
        if (restSeconds == null) return null
        const mins = Math.floor(restSeconds / 60)
        const secs = restSeconds % 60
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}`
        }
        return `${secs}с`
    }

    if (compact) {
        return (
            <div className={cn('flex items-center gap-1.5 text-xs text-telegram-hint', className)}>
                {exerciseType === 'strength' && (
                    <>
                        {ghost.weight != null && (
                            <span className="font-medium">{ghost.weight}кг</span>
                        )}
                        {ghost.reps != null && (
                            <span>×{ghost.reps}</span>
                        )}
                    </>
                )}
                {exerciseType === 'cardio' && ghost.duration != null && (
                    <span>{formatDuration(ghost.duration)}</span>
                )}
            </div>
        )
    }

    return (
        <div
            className={cn(
                'rounded-lg border border-telegram-hint/20 bg-telegram-bg/50 p-2',
                className,
            )}
        >
            <div className="flex items-center gap-2 text-xs text-telegram-hint">
                <span className="font-medium uppercase tracking-wide">Прошлый раз</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
                {exerciseType === 'strength' && (
                    <>
                        <div className="flex items-center gap-1.5">
                            <Weight className="h-3.5 w-3.5 text-telegram-hint" />
                            <span className="text-sm font-semibold text-telegram-text">
                                {ghost.weight != null ? formatWeight(ghost.weight) : '—'}
                            </span>
                        </div>
                        <div className="text-sm font-medium text-telegram-text">
                            {ghost.reps != null ? formatReps(ghost.reps) : '—'}
                        </div>
                    </>
                )}

                {exerciseType === 'cardio' && (
                    <>
                        <div className="flex items-center gap-1.5">
                            <Timer className="h-3.5 w-3.5 text-telegram-hint" />
                            <span className="text-sm font-semibold text-telegram-text">
                                {formatDuration(ghost.duration)}
                            </span>
                        </div>
                        {ghost.distance != null && (
                            <div className="text-sm font-medium text-telegram-text">
                                {ghost.distance} км
                            </div>
                        )}
                    </>
                )}

                {ghost.rpe != null && (
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-telegram-hint">RPE</span>
                        <span className="text-sm font-semibold text-telegram-text">
                            {ghost.rpe}
                        </span>
                    </div>
                )}

                {ghost.restSeconds != null && (
                    <div className="flex items-center gap-1.5 text-xs text-telegram-hint">
                        <Timer className="h-3 w-3" />
                        <span>отдых {formatRest(ghost.restSeconds)}</span>
                    </div>
                )}
            </div>
        </div>
    )
})
