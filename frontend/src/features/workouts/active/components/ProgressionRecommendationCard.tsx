import { Suspense, lazy, memo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowDownRight, HelpCircle, Loader2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { ProgressionRecommendation as Recommendation } from '../hooks/useProgressionRecommendation'

// SPEC-006 §46: the explanation sheet is only needed once the user asks for it.
const ProgressionWhySheet = lazy(() => import('./ProgressionWhySheet'))

export interface ProgressionRecommendationCardProps {
    recommendation?: Recommendation | null
    isLoading?: boolean
    isError?: boolean
    onApply?: (value: number) => void
    /** SPEC-006 §42/§43: accept as-is or with the user's own value. */
    onAccept?: (recommendation: Recommendation, selectedValue?: number) => void
    /** SPEC-006 §44. */
    onReject?: (recommendation: Recommendation) => void
    isDeciding?: boolean
    /** Previous sets of the source session, for the "Почему?" sheet. */
    previousSets?: Array<{ set_number?: number; reps?: number | null; weight?: number | null; duration?: number | null }>
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

const STATUS_LABELS: Record<string, string> = {
    INCREASE: 'Увеличиваем нагрузку',
    KEEP: 'Оставляем нагрузку',
    DECREASE: 'Снижаем нагрузку',
    DELOAD: 'Разгрузка',
    MANUAL: 'Ручная прогрессия',
    INSUFFICIENT_DATA: 'Недостаточно данных',
}

const LIFECYCLE_LABELS: Record<string, string> = {
    accepted: 'Принято',
    modified: 'Изменено вами',
    rejected: 'Отклонено',
    expired: 'Устарело',
}

function formatValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—'
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function isTimed(recommendation: Recommendation): boolean {
    return (
        recommendation.policy === 'TIME_PROGRESSION' ||
        (recommendation.recommended_duration != null &&
            recommendation.recommended_value == null)
    )
}

function unitFor(recommendation: Recommendation): string {
    return isTimed(recommendation) ? 'сек' : 'кг'
}

/**
 * SPEC-006 §45–§49: one card, always explainable — the number never appears
 * without status, policy and reason, and accepting is always explicit.
 */
export const ProgressionRecommendationCard = memo(function ProgressionRecommendationCard({
    recommendation,
    isLoading,
    isError,
    onApply,
    onAccept,
    onReject,
    isDeciding,
    previousSets,
    className,
}: ProgressionRecommendationCardProps) {
    const [isWhyOpen, setIsWhyOpen] = useState(false)

    if (isLoading) {
        return (
            <div className={cn('rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-2 text-sm font-bold text-telegram-hint', className)}>
                Расчёт рекомендации...
            </div>
        )
    }

    if (isError || !recommendation) {
        return null
    }

    const status = recommendation.status ?? null
    const isManual = status === 'MANUAL' || recommendation.policy === 'MANUAL'
    const isInsufficient = status === 'INSUFFICIENT_DATA'
    const isDeload = status === 'DELOAD'
    const isDrop = status === 'DECREASE' || isDeload
    const difference = recommendation.difference ?? 0
    const isFlat = isManual || isInsufficient || status === 'KEEP' || difference === 0
    const direction = isDrop ? 'down' : isFlat ? 'flat' : 'up'
    const DirectionIcon =
        isDeload ? ArrowDownRight : direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus

    const unit = unitFor(recommendation)
    const headline = isManual
        ? `Прошлый вес ${formatValue(recommendation.previous_value)} ${unit}`
        : isInsufficient
            ? 'Недостаточно данных'
            : `${isDrop ? 'Снижаем' : status === 'KEEP' ? 'Оставляем' : 'Следующая цель'} ${formatValue(
                recommendation.recommended_value ?? recommendation.previous_value,
            )} ${unit}`

    const repsRange =
        recommendation.reps_min != null && recommendation.reps_max != null
            ? `${recommendation.reps_min}–${recommendation.reps_max} повторов`
            : null
    const canDecide = Boolean(recommendation.id) && Boolean(onAccept || onReject)
    const lifecycle = recommendation.lifecycle_status ?? null
    const isDecided = lifecycle === 'accepted' || lifecycle === 'modified' || lifecycle === 'rejected'

    return (
        <div
            data-testid="progression-recommendation"
            data-status={status ?? 'UNKNOWN'}
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
                            {headline}
                        </span>
                        {!isFlat && !isManual && !isInsufficient ? (
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
                        {STATUS_LABELS[status ?? ''] ?? POLICY_LABELS[recommendation.policy] ?? recommendation.policy}
                        {repsRange ? ` · ${repsRange}` : ''}
                    </p>

                    {/* §37/§46: reason is always reachable from the number. */}
                    <div className="mt-2 space-y-1 text-xs font-semibold text-telegram-hint">
                        <p>
                            Политика: {POLICY_LABELS[recommendation.policy] ?? recommendation.policy}
                        </p>
                        <p data-testid="progression-reason">{recommendation.reason_text || '—'}</p>
                        {recommendation.recovery_warning ? (
                            <p className="font-bold text-warning">{recommendation.recovery_warning}</p>
                        ) : null}
                    </div>

                    {isInsufficient ? (
                        <p className="mt-2 text-xs font-bold text-telegram-hint">
                            Завершите ещё одну тренировку, чтобы FitTracker смог рассчитать следующую цель.
                        </p>
                    ) : null}

                    {/* SPEC-006 §58: the target stays accepted, its automatic
                        prefill does not come back without a new decision. */}
                    {recommendation.prefill_declined ? (
                        <p
                            data-testid="progression-prefill-declined"
                            className="mt-2 text-xs font-bold text-telegram-hint"
                        >
                            Автоподстановка выключена: цель не подставляется в новые тренировки сама.
                        </p>
                    ) : null}

                    {lifecycle && LIFECYCLE_LABELS[lifecycle] ? (
                        <p
                            data-testid="progression-lifecycle"
                            className="mt-2 text-xs font-black uppercase tracking-wide text-[#4ADE80]"
                        >
                            {LIFECYCLE_LABELS[lifecycle]}
                            {recommendation.actual_selected_value != null
                                ? ` · ${formatValue(recommendation.actual_selected_value)} ${unit}`
                                : ''}
                        </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {typeof recommendation.recommended_value === 'number' && onApply ? (
                            <button
                                type="button"
                                onClick={() => onApply(recommendation.recommended_value as number)}
                                className="min-h-9 rounded-xl border border-[#4ADE80]/40 bg-[#4ADE80]/10 px-3 text-xs font-black text-[#4ADE80] active:bg-[#4ADE80]/20"
                            >
                                Подставить {formatValue(recommendation.recommended_value)} {unit}
                            </button>
                        ) : null}

                        {canDecide && !isDecided ? (
                            <>
                                <button
                                    type="button"
                                    data-testid="progression-accept"
                                    disabled={isDeciding}
                                    onClick={() => onAccept?.(recommendation)}
                                    className="min-h-9 rounded-xl border border-[#4ADE80]/40 bg-[#4ADE80]/15 px-3 text-xs font-black text-[#4ADE80] disabled:opacity-50"
                                >
                                    {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Принять'}
                                </button>
                                <button
                                    type="button"
                                    data-testid="progression-reject"
                                    disabled={isDeciding}
                                    onClick={() => onReject?.(recommendation)}
                                    className="min-h-9 rounded-xl border border-white/[0.12] bg-black/20 px-3 text-xs font-black text-telegram-hint disabled:opacity-50"
                                >
                                    Отклонить
                                </button>
                            </>
                        ) : null}

                        <button
                            type="button"
                            data-testid="progression-why"
                            onClick={() => setIsWhyOpen(true)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-white/[0.12] bg-black/20 px-3 text-xs font-black text-telegram-text"
                        >
                            <HelpCircle className="h-3.5 w-3.5" />
                            Почему?
                        </button>
                    </div>
                </div>
            </div>

            {isWhyOpen ? (
                <Suspense fallback={null}>
                    <ProgressionWhySheet
                        recommendation={recommendation}
                        previousSets={previousSets}
                        isOpen
                        onClose={() => setIsWhyOpen(false)}
                    />
                </Suspense>
            ) : null}
        </div>
    )
})
