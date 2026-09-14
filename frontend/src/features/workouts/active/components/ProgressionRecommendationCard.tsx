import { memo } from 'react'
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { ProgressionRecommendation as Recommendation } from '../hooks/useProgressionRecommendation'

export interface ProgressionRecommendationCardProps {
    recommendation?: Recommendation | null
    isLoading?: boolean
    isError?: boolean
    onApply?: (value: number) => void
    className?: string
}

const POLICY_LABELS: Record<string, string> = {
    MANUAL: 'Ручная прогрессия',
    LINEAR: 'Линейная прогрессия',
    DOUBLE_PROGRESSION: 'Двойная прогрессия',
    RPE_BASED: 'Прогрессия по RPE',
    RIR_BASED: 'Прогрессия по RIR',
    PERCENT_1RM: 'Процент от 1ПМ',
    TIME_PROGRESSION: 'Прогрессия по времени',
}

function formatValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—'
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * SPEC-005 §37: explainable recommendation. Never shows a bare number —
 * always difference + previous result + policy + reason (AC-005-015).
 */
export const ProgressionRecommendationCard = memo(function ProgressionRecommendationCard({
    recommendation,
    isLoading,
    isError,
    onApply,
    className,
}: ProgressionRecommendationCardProps) {
    if (isLoading) {
        return (
            <div className={cn('rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-2 text-sm font-bold text-telegram-hint', className)}>
                Расчёт рекомендации...
            </div>
        )
    }

    if (isError || !recommendation) {
        if (isError) {
            return (
                <div className={cn('rounded-[16px] border border-white/[0.06] bg-black/10 px-3 py-2 text-xs font-semibold text-telegram-hint', className)}>
                    Рекомендация недоступна
                </div>
            )
        }
        return null
    }

    const isManual = recommendation.reason_code === 'MANUAL_POLICY' || recommendation.policy === 'MANUAL'
    const noData = recommendation.recommended_value == null && !isManual
    const recommended = recommendation.recommended_value
    const difference = recommendation.difference ?? 0
    const direction = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat'
    const DirectionIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus

    return (
        <div
            data-testid="progression-recommendation"
            className={cn(
                'rounded-[16px] border px-3 py-3',
                direction === 'up'
                    ? 'border-[#4ADE80]/25 bg-[#4ADE80]/10'
                    : direction === 'down'
                        ? 'border-warning/30 bg-warning/10'
                        : 'border-white/[0.08] bg-black/20',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                        direction === 'up'
                            ? 'bg-[#22C55E]/15 text-[#4ADE80]'
                            : direction === 'down'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-white/[0.06] text-telegram-hint',
                    )}
                >
                    <DirectionIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black tabular-nums text-telegram-text">
                            {isManual ? 'Прошлый вес' : `${formatValue(recommended)} кг`}
                        </span>
                        {direction !== 'flat' && !isManual ? (
                            <span
                                className={cn(
                                    'text-xs font-black',
                                    direction === 'up' ? 'text-[#4ADE80]' : 'text-warning',
                                )}
                            >
                                {difference > 0 ? `↑ +${formatValue(difference)}` : `↓ ${formatValue(difference)}`}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-telegram-hint">
                        {POLICY_LABELS[recommendation.policy] ?? recommendation.policy}
                    </p>

                    {/* §37: "Почему?" — previous result + reason are mandatory */}
                    <div className="mt-2 space-y-1 text-xs font-semibold text-telegram-hint">
                        {recommendation.previous_value != null ? (
                            <p>Прошлый результат: {formatValue(recommendation.previous_value)} кг</p>
                        ) : null}
                        <p className="flex items-start gap-1">
                            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{recommendation.reason_text || '—'}</span>
                        </p>
                    </div>

                    {noData ? (
                        <p className="mt-2 text-xs font-bold text-telegram-hint">
                            Первое выполнение упражнения
                        </p>
                    ) : null}

                    {typeof recommended === 'number' && onApply ? (
                        <button
                            type="button"
                            onClick={() => onApply(recommended as number)}
                            className="mt-2 min-h-9 rounded-xl border border-[#4ADE80]/40 bg-[#4ADE80]/10 px-3 text-xs font-black text-[#4ADE80] active:bg-[#4ADE80]/20"
                        >
                            Подставить {formatValue(recommended)} кг
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
})
