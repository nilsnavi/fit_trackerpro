import { memo } from 'react'
import { Lightbulb, Loader2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'

export interface WeightRecommendationChipProps {
    /** Рекомендованный вес (кг) */
    suggestedWeight?: number
    /** Сообщение от API */
    message?: string
    /** Загрузка */
    isLoading?: boolean
    /** Ошибка */
    isError?: boolean
    /** Callback для применения рекомендации */
    onApply?: () => void
    /** Дополнительные классы */
    className?: string
    /** Компактный режим (без сообщения) */
    compact?: boolean
}

/**
 * Compact chip для отображения рекомендации веса после завершения подхода с RPE.
 * 
 * Показывает:
 * - 💡 Следующий подход: 82.5 кг [Подставить]
 * - Loading state
 * - Error state
 */
export const WeightRecommendationChip = memo(function WeightRecommendationChip({
    suggestedWeight,
    message,
    isLoading,
    isError,
    onApply,
    className,
    compact = false,
}: WeightRecommendationChipProps) {
    // Loading state
    if (isLoading) {
        return (
            <div
                className={cn(
                    'flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2',
                    className
                )}
                data-testid="weight-rec-loading"
            >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-telegram-hint">Расчёт рекомендации...</span>
            </div>
        )
    }

    // Error state
    if (isError) {
        return (
            <div
                className={cn(
                    'flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2',
                    className
                )}
                data-testid="weight-rec-error"
            >
                <span className="text-xs text-danger">Ошибка расчёта веса</span>
            </div>
        )
    }

    // No recommendation
    if (suggestedWeight == null && !message) {
        return null
    }

    // Compact mode - just the weight and apply button
    if (compact && suggestedWeight != null) {
        return (
            <div
                className={cn(
                    'flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2',
                    className
                )}
                data-testid="weight-rec-chip"
            >
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-telegram-text">
                    След. подход: <span className="font-bold text-primary">{suggestedWeight} кг</span>
                </span>
                {onApply && (
                    <button
                        type="button"
                        onClick={onApply}
                        className="ml-auto min-h-8 touch-manipulation rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground active:opacity-90"
                        data-testid="weight-rec-apply-btn"
                    >
                        Подставить
                    </button>
                )}
            </div>
        )
    }

    // Full mode with message
    return (
        <div
            className={cn(
                'rounded-lg border border-primary/30 bg-primary/5 p-2.5',
                className
            )}
            data-testid="weight-rec-full"
        >
            <div className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Рекомендация
                </span>
            </div>

            {suggestedWeight != null && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-primary">
                        {suggestedWeight} кг
                    </span>
                    {onApply && (
                        <button
                            type="button"
                            onClick={onApply}
                            className="min-h-9 touch-manipulation rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground active:opacity-90"
                            data-testid="weight-rec-apply-btn"
                        >
                            Подставить
                        </button>
                    )}
                </div>
            )}

            {message && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-telegram-hint">
                    {message}
                </p>
            )}
        </div>
    )
})

WeightRecommendationChip.displayName = 'WeightRecommendationChip'
