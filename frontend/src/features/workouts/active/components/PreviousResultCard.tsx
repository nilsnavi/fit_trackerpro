import { memo } from 'react'
import { History } from 'lucide-react'
import type { PreviousExerciseResult } from '../lib/previousResult'
import { formatPreviousSetLine } from '../lib/previousResult'

export interface PreviousResultCardProps {
    previous?: PreviousExerciseResult | null
    className?: string
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('ru-RU')
    } catch {
        return iso
    }
}

/**
 * SPEC-005 §8: previous completed result for the exercise.
 * Warm-up sets excluded (AC-005-003). Shows "Первое выполнение упражнения"
 * when there is no history.
 */
export const PreviousResultCard = memo(function PreviousResultCard({
    previous,
    className,
}: PreviousResultCardProps) {
    if (!previous) {
        return (
            <div
                data-testid="previous-result"
                className={`rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-3 ${className ?? ''}`}
            >
                <p className="text-xs font-bold uppercase tracking-wide text-telegram-hint">
                    Предыдущая тренировка
                </p>
                <p className="mt-1 text-sm font-semibold text-telegram-hint">
                    Первое выполнение упражнения
                </p>
            </div>
        )
    }

    const avgRpe =
        previous.rpeValues.length > 0
            ? previous.rpeValues.reduce((sum, value) => sum + value, 0) / previous.rpeValues.length
            : null

    return (
        <div
            data-testid="previous-result"
            className={`rounded-[16px] border border-white/[0.08] bg-black/20 px-3 py-3 ${className ?? ''}`}
        >
            <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-telegram-hint" />
                <p className="text-xs font-bold uppercase tracking-wide text-telegram-hint">
                    Предыдущая тренировка · {formatDate(previous.date)}
                </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {previous.sets.map((set, index) => (
                    <span
                        key={`${set.set_number}-${index}`}
                        className="rounded-xl bg-white/[0.06] px-2.5 py-1 text-sm font-black tabular-nums text-telegram-text"
                    >
                        {formatPreviousSetLine(set)}
                    </span>
                ))}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-telegram-hint">
                {avgRpe != null ? <span>RPE: {avgRpe.toFixed(1)}</span> : null}
                <span>Объём: {previous.volume} кг</span>
            </div>
        </div>
    )
})
