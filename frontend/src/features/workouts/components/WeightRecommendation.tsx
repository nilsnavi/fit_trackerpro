/**
 * WeightRecommendation Component
 * 
 * Компонент отображения рекомендаций по весу для упражнения.
 * Pure UI component.
 */

import { TrendingUp, Info } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface WeightRecommendationProps {
    recommendedWeight: number | null
    previousWeight: number | null
    confidence?: 'low' | 'medium' | 'high'
    className?: string
}

export function WeightRecommendation({
    recommendedWeight,
    previousWeight,
    confidence = 'medium',
    className,
}: WeightRecommendationProps) {
    if (recommendedWeight === null) {
        return null
    }

    const change = previousWeight !== null ? recommendedWeight - previousWeight : 0
    const changePercent = previousWeight !== null && previousWeight > 0
        ? (change / previousWeight) * 100
        : 0

    const confidenceColors = {
        low: 'text-orange-500',
        medium: 'text-yellow-500',
        high: 'text-green-500',
    }

    const confidenceLabels = {
        low: 'Низкая уверенность',
        medium: 'Средняя уверенность',
        high: 'Высокая уверенность',
    }

    return (
        <div className={cn('rounded-xl bg-telegram-secondary-bg p-4', className)}>
            <div className="flex items-start gap-3">
                {/* Иконка */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                </div>

                {/* Рекомендация */}
                <div className="flex-1">
                    <p className="text-xs font-medium text-telegram-hint">Рекомендуемый вес</p>
                    <p className="mt-1 text-2xl font-bold text-telegram-text">
                        {recommendedWeight} кг
                    </p>

                    {/* Изменение */}
                    {change !== 0 && previousWeight !== null && (
                        <p
                            className={cn(
                                'mt-1 text-xs font-medium',
                                change > 0 ? 'text-success' : 'text-destructive',
                            )}
                        >
                            {change > 0 ? '+' : ''}{change.toFixed(1)} кг ({changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                        </p>
                    )}

                    {/* Уровень уверенности */}
                    <div className="mt-2 flex items-center gap-1.5">
                        <Info className={cn('h-3.5 w-3.5', confidenceColors[confidence])} />
                        <span className={cn('text-xs', confidenceColors[confidence])}>
                            {confidenceLabels[confidence]}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
