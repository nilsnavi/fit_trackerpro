import { memo, useCallback, useEffect, useState } from 'react'
import { Play, SkipForward, RotateCcw, Zap, Brain } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useSmartRest, useAutoStartRest, useHapticIntensity } from '@/stores/workoutSmartSettingsStore'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { REST_PRESETS, formatRestTime } from '../lib/calculateSmartRest'
import type { RestPreset } from '../lib/calculateSmartRest'

export interface SmartRestTimerProps {
    /** Рассчитанное время отдыха (секунды) */
    calculatedRestSeconds: number
    /** Рекомендация по отдыху */
    recommendation?: string
    /** Использовался ли предыдущий отдых */
    usedPreviousRest?: boolean
    /** Callback при старте таймера */
    onStart: (seconds: number) => void
    /** Callback при паузе */
    onPause?: () => void
    /** Callback при пропуске */
    onSkip?: () => void
    /** Callback при рестарте */
    onRestart?: () => void
    /** Автостарт при монтировании */
    autoStart?: boolean
    /** Дополнительные классы */
    className?: string
}

/**
 * Smart Rest Timer — умный таймер отдыха с пресетами и адаптивным расчётом.
 */
export const SmartRestTimer = memo(function SmartRestTimer({
    calculatedRestSeconds,
    recommendation,
    usedPreviousRest = false,
    onStart,
    // onPause — зарезервировано для будущей функциональности
    onSkip,
    onRestart,
    autoStart = false,
    className,
}: SmartRestTimerProps) {
    const smartRestEnabled = useSmartRest()
    const autoStartRestEnabled = useAutoStartRest()
    const hapticIntensity = useHapticIntensity()
    const { hapticFeedback } = useTelegramWebApp()
    const [selectedPreset, setSelectedPreset] = useState<RestPreset | null>(null)
    const [isStarted, setIsStarted] = useState(false)

    const effectiveRest = selectedPreset ?? calculatedRestSeconds

    const handleHaptic = useCallback(() => {
        const style = hapticIntensity === 'light' ? 'light' : hapticIntensity === 'heavy' ? 'heavy' : 'medium'
        hapticFeedback({ type: 'impact', style })
    }, [hapticFeedback, hapticIntensity])

    const handlePresetSelect = useCallback((preset: RestPreset) => {
        handleHaptic()
        setSelectedPreset(preset)
    }, [handleHaptic])

    const handleStart = useCallback(() => {
        handleHaptic()
        setIsStarted(true)
        onStart(effectiveRest)
    }, [handleHaptic, effectiveRest, onStart])

    useEffect(() => {
        if ((autoStart || autoStartRestEnabled) && !isStarted) {
            setIsStarted(true)
            onStart(effectiveRest)
        }
    }, [autoStart, autoStartRestEnabled, effectiveRest, isStarted, onStart])

    return (
        <div className={cn('rounded-xl bg-telegram-secondary-bg p-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-telegram-text">Умный отдых</span>
                </div>
                {usedPreviousRest && (
                    <div className="flex items-center gap-1 text-xs text-telegram-hint">
                        <Zap className="h-3 w-3" />
                        <span>На основе прошлого</span>
                    </div>
                )}
            </div>

            {/* Recommendation */}
            {recommendation && smartRestEnabled && (
                <p className="mt-2 text-sm text-telegram-hint">{recommendation}</p>
            )}

            {/* Rest time display */}
            <div className="mt-4 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-2xl font-bold text-primary">
                        {formatRestTime(effectiveRest)}
                    </span>
                </div>
            </div>

            {/* Presets */}
            <div className="mt-4 flex items-center justify-center gap-2">
                {REST_PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetSelect(preset)}
                        className={cn(
                            'flex h-10 min-w-[48px] items-center justify-center rounded-lg text-sm font-semibold transition-all',
                            selectedPreset === preset
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text hover:bg-primary/10',
                        )}
                    >
                        {formatRestTime(preset)}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
                >
                    <Play className="h-4 w-4" />
                    Старт
                </button>
                {onRestart && (
                    <button
                        type="button"
                        onClick={() => {
                            handleHaptic()
                            onRestart()
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-telegram-bg py-3 text-sm font-semibold text-telegram-text transition-transform active:scale-[0.98]"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Сброс
                    </button>
                )}
                {onSkip && (
                    <button
                        type="button"
                        onClick={() => {
                            handleHaptic()
                            onSkip()
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-telegram-bg py-3 text-sm font-semibold text-telegram-hint transition-transform active:scale-[0.98]"
                    >
                        <SkipForward className="h-4 w-4" />
                        Пропустить
                    </button>
                )}
            </div>
        </div>
    )
})

/**
 * Inline версия таймера для использования в карточках.
 */
export const SmartRestTimerInline = memo(function SmartRestTimerInline({
    restSeconds,
    onStart,
    className,
}: {
    restSeconds: number
    onStart: (seconds: number) => void
    className?: string
}) {
    const handleHaptic = useCallback(() => {
        // Default haptic
    }, [])

    return (
        <button
            type="button"
            onClick={() => {
                handleHaptic()
                onStart(restSeconds)
            }}
            className={cn(
                'flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20',
                className,
            )}
        >
            <Zap className="h-4 w-4" />
            <span>Отдых: {formatRestTime(restSeconds)}</span>
        </button>
    )
})
