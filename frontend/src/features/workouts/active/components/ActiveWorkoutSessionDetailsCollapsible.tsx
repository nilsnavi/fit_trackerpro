import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { SessionSummaryCard } from '@features/workouts/active/components/SessionSummaryCard'

export interface ActiveWorkoutSessionDetailsCollapsibleProps {
    workout: WorkoutHistoryItem
    workoutTitle: string
    elapsedLabel: string
    isActiveDraft: boolean
    durationMinutes: number
    exerciseCount: number
    completedSetCount: number
    onDurationChange: (minutes: number) => void
    onCommentsChange: (value: string) => void
    onOpenRestPresets: () => void
}

/**
 * Длительность, комментарий и инсайты — свёрнуты по умолчанию, чтобы не отвлекать от подходов.
 */
export function ActiveWorkoutSessionDetailsCollapsible({
    workout,
    workoutTitle,
    elapsedLabel,
    isActiveDraft,
    durationMinutes,
    exerciseCount,
    completedSetCount,
    onDurationChange,
    onCommentsChange,
    onOpenRestPresets,
}: ActiveWorkoutSessionDetailsCollapsibleProps) {
    return (
        <details className="group rounded-xl border border-border bg-telegram-secondary-bg/80">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-telegram-text marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                    Параметры и заметки к сессии
                    <span className="text-xs font-normal text-telegram-hint group-open:hidden">Развернуть</span>
                    <span className="hidden text-xs font-normal text-telegram-hint group-open:inline">Свернуть</span>
                </span>
            </summary>
            <div className="border-t border-border px-2 pb-2 pt-0 space-y-2">
                <button
                    type="button"
                    onClick={onOpenRestPresets}
                    className="mt-2 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2.5 text-left text-sm font-medium text-telegram-text touch-manipulation active:bg-telegram-secondary-bg"
                >
                    Пресеты отдыха (секунды)
                </button>
                <SessionSummaryCard
                    workout={workout}
                    workoutTitle={workoutTitle}
                    elapsedLabel={elapsedLabel}
                    isActiveDraft={isActiveDraft}
                    durationMinutes={durationMinutes}
                    exerciseCount={exerciseCount}
                    completedSetCount={completedSetCount}
                    onDurationChange={onDurationChange}
                    onCommentsChange={onCommentsChange}
                    showSessionOverview={false}
                />
            </div>
        </details>
    )
}
