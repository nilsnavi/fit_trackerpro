import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Star, TrendingUp } from 'lucide-react'
import type { ApiProgressInsightsPRItem } from '@features/analytics/api/analyticsDomain'

interface PREventCardProps {
    item: ApiProgressInsightsPRItem
    className?: string
}

export function PREventCard({ item, className = 'rounded-xl bg-telegram-bg p-3' }: PREventCardProps) {
    const improvementBadge = item.is_first_entry ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-400">
            <Star className="h-3 w-3" />
            Первый
        </span>
    ) : item.improvement_pct != null && item.improvement_pct > 0 ? (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                item.improvement_pct >= 10
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-amber-500/15 text-amber-400'
            }`}
        >
            <TrendingUp className="h-3 w-3" />
            +{Math.round(item.improvement_pct)}%
        </span>
    ) : null

    const weightReps = [
        item.weight != null ? `${item.weight} кг` : null,
        item.reps != null ? `× ${item.reps} повт` : null,
    ]
        .filter(Boolean)
        .join(' ')

    const dateLabel = item.date ? format(new Date(item.date), 'dd MMM', { locale: ru }) : null

    return (
        <article className={className}>
            <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-telegram-text">{item.exercise_name}</p>
                {improvementBadge}
            </div>
            <p className="mt-1 text-xs text-telegram-hint">
                {weightReps || 'Без веса'}
                {dateLabel ? ` • ${dateLabel}` : ''}
                {item.previous_best_weight != null && !item.is_first_entry
                    ? ` • было ${item.previous_best_weight} кг`
                    : ''}
            </p>
        </article>
    )
}
