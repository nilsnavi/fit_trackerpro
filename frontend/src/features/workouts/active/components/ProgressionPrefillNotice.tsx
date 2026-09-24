import { memo } from 'react'
import { Sparkles, Undo2 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import { describeProgressionPrefill } from '../lib/progressionPrefill'

export interface ProgressionPrefillNoticeProps {
    exercise: CompletedExercise
    /** SPEC-006 §58: restores the planned numbers in one tap. */
    onRevert?: () => void
    className?: string
}

/**
 * SPEC-006 §58: the seeded number is never silently indistinguishable from the
 * user's own — this notice says where it came from and undoes it in one tap.
 */
export const ProgressionPrefillNotice = memo(function ProgressionPrefillNotice({
    exercise,
    onRevert,
    className,
}: ProgressionPrefillNoticeProps) {
    const prefill = describeProgressionPrefill(exercise)
    if (!prefill) return null

    const { label, plannedLabel, target } = prefill
    const isTimed = target.unit === 'seconds'

    return (
        <div
            data-testid="progression-prefill-notice"
            data-unit={target.unit}
            className={cn(
                'flex items-start gap-3 rounded-[16px] border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-3',
                className,
            )}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/15 text-[#7DD3FC]">
                <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-telegram-text">
                    {isTimed ? 'Время' : 'Вес'} {label} {isTimed ? 'подставлено' : 'подставлен'}{' '}
                    принятой целью прогрессии
                </p>
                <p className="mt-0.5 text-xs font-semibold text-telegram-hint">
                    {plannedLabel
                        ? `В плане было ${plannedLabel}`
                        : 'В плане значения не было'}
                </p>
                {onRevert ? (
                    <button
                        type="button"
                        data-testid="progression-prefill-revert"
                        onClick={onRevert}
                        className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-xl border border-white/[0.12] bg-black/20 px-3 text-xs font-black text-telegram-text active:bg-white/[0.06]"
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                        {plannedLabel ? `Вернуть ${plannedLabel}` : 'Очистить'}
                    </button>
                ) : null}
            </div>
        </div>
    )
})
