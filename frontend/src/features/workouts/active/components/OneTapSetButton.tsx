import { memo, useCallback, useState } from 'react'
import { Check, Play, Timer, Zap } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useGhostMode, useHapticIntensity } from '@/stores/workoutSmartSettingsStore'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import type { CompletedSet } from '@features/workouts/types/workouts'
import type { GhostModeSetData } from '../hooks/useGhostModeData'

export interface OneTapSetButtonProps {
    /** Текущие данные подхода */
    currentSet: Partial<CompletedSet> | null
    /** Ghost данные для сравнения */
    ghostSet: GhostModeSetData | null
    /** Завершён ли подход */
    isCompleted: boolean
    /** Есть ли следующий подход */
    hasNextSet: boolean
    /** Включён ли автостарт отдыха */
    autoStartRestEnabled?: boolean
    /** Callback при завершении подхода */
    onComplete: (opts: { startRest: boolean; restSeconds?: number }) => void
    /** Callback при пропуске подхода */
    onSkip?: () => void
    /** Callback для копирования предыдущего подхода */
    onCopyPrevious?: () => void
    /** RPE для quick select */
    onRpeSelect?: (rpe: number) => void
    /** Дополнительные классы */
    className?: string
}

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const

/**
 * Большая кнопка для one-tap завершения подхода.
 * Включает quick RPE select и автоматический переход к отдыху.
 */
export const OneTapSetButton = memo(function OneTapSetButton({
    currentSet,
    ghostSet,
    isCompleted,
    hasNextSet,
    autoStartRestEnabled = true,
    onComplete,
    onSkip,
    onCopyPrevious,
    onRpeSelect,
    className,
}: OneTapSetButtonProps) {
    const ghostModeEnabled = useGhostMode()
    const hapticIntensity = useHapticIntensity()
    const { hapticFeedback } = useTelegramWebApp()
    const [selectedRpe, setSelectedRpe] = useState<number | null>(currentSet?.rpe ?? null)

    const handleHaptic = useCallback(() => {
        const style = hapticIntensity === 'light' ? 'light' : hapticIntensity === 'heavy' ? 'heavy' : 'medium'
        hapticFeedback({ type: 'impact', style })
    }, [hapticFeedback, hapticIntensity])

    const handleComplete = useCallback(() => {
        handleHaptic()
        onComplete({ startRest: autoStartRestEnabled && hasNextSet })
    }, [handleHaptic, onComplete, autoStartRestEnabled, hasNextSet])

    const handleRpeClick = useCallback((rpe: number) => {
        handleHaptic()
        setSelectedRpe(rpe)
        onRpeSelect?.(rpe)
    }, [handleHaptic, onRpeSelect])

    // Если подход уже завершён
    if (isCompleted) {
        return (
            <div className={cn('space-y-3', className)}>
                <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 py-4 text-emerald-500">
                    <Check className="h-5 w-5" />
                    <span className="font-semibold">Подход завершён</span>
                </div>
                {hasNextSet && (
                    <button
                        type="button"
                        onClick={handleComplete}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-semibold text-white transition-transform active:scale-[0.98]"
                    >
                        <Play className="h-5 w-5" />
                        Следующий подход
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className={cn('space-y-3', className)}>
            {/* Quick RPE Select */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-telegram-hint">RPE (опционально)</span>
                <div className="flex items-center gap-1">
                    {RPE_OPTIONS.map((rpe) => (
                        <button
                            key={rpe}
                            type="button"
                            onClick={() => handleRpeClick(rpe)}
                            className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all',
                                selectedRpe === rpe
                                    ? 'bg-primary text-white'
                                    : 'bg-telegram-secondary-bg text-telegram-text hover:bg-primary/20',
                            )}
                        >
                            {rpe}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ghost hint */}
            {ghostModeEnabled && ghostSet && !currentSet?.weight && !currentSet?.reps && (
                <button
                    type="button"
                    onClick={onCopyPrevious}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 py-3 text-sm text-primary transition-colors hover:bg-primary/10"
                >
                    <Zap className="h-4 w-4" />
                    Копировать прошлый: {ghostSet.weight}кг × {ghostSet.reps}
                </button>
            )}

            {/* Main action button */}
            <button
                type="button"
                onClick={handleComplete}
                className={cn(
                    'flex w-full min-h-[56px] items-center justify-center gap-3 rounded-xl text-lg font-semibold transition-transform active:scale-[0.98]',
                    'bg-primary text-white shadow-lg shadow-primary/25',
                )}
            >
                <Check className="h-6 w-6" />
                <span>Готово</span>
                {autoStartRestEnabled && hasNextSet && (
                    <Timer className="h-4 w-4 opacity-70" />
                )}
            </button>

            {/* Skip option */}
            {onSkip && (
                <button
                    type="button"
                    onClick={onSkip}
                    className="w-full rounded-xl py-3 text-sm text-telegram-hint transition-colors hover:text-telegram-text"
                >
                    Пропустить подход
                </button>
            )}
        </div>
    )
})
