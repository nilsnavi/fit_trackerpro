import { memo } from 'react'
import { CheckCircle2, Clock3, Dumbbell } from 'lucide-react'

export interface WorkoutProgressBarProps {
    exerciseCount: number
    exercisesDoneCount: number
    completedSetCount: number
    totalSetCount: number
    elapsedLabel: string
}

/**
 * WorkoutProgressBar Component
 * 
 * Отображает статистику и прогресс тренировки.
 * Pure presentational component - только UI, без логики.
 */
export const WorkoutProgressBar = memo(function WorkoutProgressBar({
    exerciseCount,
    exercisesDoneCount,
    completedSetCount,
    totalSetCount,
    elapsedLabel,
}: WorkoutProgressBarProps) {
    const progressPercentage = totalSetCount > 0 ? (completedSetCount / totalSetCount) * 100 : 0

    return (
        <div className="rounded-2xl border border-border bg-telegram-secondary-bg/80 p-3 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-telegram-bg/80 p-3">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-lg font-bold tabular-nums text-telegram-text">{exerciseCount}</p>
                    <p className="text-[11px] leading-tight text-telegram-hint">упражнений</p>
                </div>
                <div className="rounded-xl bg-telegram-bg/80 p-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <p className="mt-2 text-lg font-bold tabular-nums text-telegram-text">{exercisesDoneCount}</p>
                    <p className="text-[11px] leading-tight text-telegram-hint">выполнено</p>
                </div>
                <div className="rounded-xl bg-telegram-bg/80 p-3">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-lg font-bold tabular-nums text-telegram-text">{elapsedLabel}</p>
                    <p className="text-[11px] leading-tight text-telegram-hint">время</p>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-medium text-telegram-hint">Общий прогресс</span>
                <span className="font-semibold text-telegram-text">
                    {completedSetCount}/{totalSetCount} подходов
                </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-telegram-bg">
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
        </div>
    )
})
