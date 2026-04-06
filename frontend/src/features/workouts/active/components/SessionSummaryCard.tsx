import { CalendarDays, Clock3 } from 'lucide-react'
import { formatDate, formatDurationMinutes } from '@features/workouts/lib/workoutDetailFormatters'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

interface SessionSummaryCardProps {
    workout: WorkoutHistoryItem
    workoutTitle: string
    elapsedLabel: string
    isActiveDraft: boolean
    durationMinutes: number
    exerciseCount: number
    completedSetCount: number
    onDurationChange: (minutes: number) => void
    onCommentsChange: (value: string) => void
}

export function SessionSummaryCard({
    workout,
    workoutTitle,
    elapsedLabel,
    isActiveDraft,
    durationMinutes,
    exerciseCount,
    completedSetCount,
    onDurationChange,
    onCommentsChange,
}: SessionSummaryCardProps) {
    return (
        <div className="rounded-xl bg-telegram-secondary-bg p-4 space-y-4">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-telegram-hint">Сессия</p>
                <h2 className="line-clamp-2 text-base font-semibold text-telegram-text">{workoutTitle}</h2>
            </div>

            <div className="flex items-center gap-2 text-sm text-telegram-hint">
                <CalendarDays className="h-4 w-4" />
                <span>{formatDate(workout.date)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-telegram-bg/60 p-2">
                    <div className="text-xs text-telegram-hint">Прошло</div>
                    <div className="mt-1 text-sm font-semibold text-telegram-text">{elapsedLabel}</div>
                </div>
                <div className="rounded-lg bg-telegram-bg/60 p-2">
                    <div className="flex items-center gap-1 text-xs text-telegram-hint">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>Длительность</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-telegram-text">
                        {formatDurationMinutes(durationMinutes)}
                    </div>
                </div>
                <div className="rounded-lg bg-telegram-bg/60 p-2">
                    <div className="text-xs text-telegram-hint">Упражнения</div>
                    <div className="mt-1 text-sm font-semibold text-telegram-text">{exerciseCount}</div>
                </div>
                <div className="rounded-lg bg-telegram-bg/60 p-2">
                    <div className="text-xs text-telegram-hint">Подходы</div>
                    <div className="mt-1 text-sm font-semibold text-telegram-text">{completedSetCount}</div>
                </div>
            </div>

            {isActiveDraft && (
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-telegram-hint">Длительность (мин)</label>
                    <input
                        type="number"
                        min={1}
                        max={1440}
                        value={durationMinutes}
                        onChange={(e) => {
                            const next = Number(e.target.value)
                            if (Number.isFinite(next)) {
                                onDurationChange(next)
                            }
                        }}
                        className="w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                    />
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-xs font-medium text-telegram-hint">
                    Комментарий (в т.ч. название сессии)
                </label>
                <textarea
                    value={workout.comments ?? ''}
                    onChange={(e) => onCommentsChange(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                />
            </div>
        </div>
    )
}
