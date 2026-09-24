import { GlassWater, Plus } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cn } from '@shared/lib/cn'
import type { WaterData } from '@shared/types'

/** Быстрое добавление воды из виджета главной. */
export const QUICK_ADD_WATER_ML = 250

interface WaterWidgetProps {
    /** null — данных ещё нет: показываем «Нет данных», а не нули. */
    data: WaterData | null
    onAddWater?: (amount: number) => void
    onClick?: () => void
}

export function WaterWidget({ data, onAddWater, onClick }: WaterWidgetProps) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onClick?.()
    }

    if (!data || data.goal <= 0) {
        return (
            <div
                role="button"
                tabIndex={0}
                data-testid="water-widget"
                onClick={onClick}
                onKeyDown={handleKeyDown}
                className="flex-shrink-0 w-36 bg-telegram-secondary-bg rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
            >
                <div className="w-12 h-12 rounded-full bg-telegram-bg flex items-center justify-center">
                    <GlassWater className="w-6 h-6 text-telegram-hint" />
                </div>
                <span className="text-sm text-telegram-hint">Нет данных</span>
                <span className="text-xs text-telegram-hint">Нажмите, чтобы добавить</span>
            </div>
        )
    }

    const percentage = Math.min(Math.round((data.current / data.goal) * 100), 100)
    const isGoalReached = data.current >= data.goal

    return (
        <div
            role="button"
            tabIndex={0}
            data-testid="water-widget"
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className="flex-shrink-0 w-36 bg-telegram-secondary-bg rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform border-l-4 border-blue-500"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-telegram-hint">Вода</span>
                <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isGoalReached ? 'bg-green-500/10' : 'bg-blue-500/10'
                )}>
                    <GlassWater className={cn(
                        'w-4 h-4',
                        isGoalReached ? 'text-green-500' : 'text-blue-500'
                    )} />
                </div>
            </div>

            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-telegram-text">{data.current}</span>
                <span className="text-xs text-telegram-hint">/{data.goal}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-telegram-bg rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isGoalReached ? 'bg-green-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="flex items-center justify-between">
                <span className={cn(
                    'text-xs font-medium',
                    isGoalReached ? 'text-green-500' : 'text-blue-500'
                )}>
                    {percentage}%
                </span>

                {onAddWater && !isGoalReached && (
                    <button
                        type="button"
                        data-testid="water-widget-add"
                        aria-label="Добавить 250 мл воды"
                        onClick={(e) => {
                            e.stopPropagation()
                            onAddWater(QUICK_ADD_WATER_ML)
                        }}
                        className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center active:scale-90 transition-transform"
                    >
                        <Plus className="w-3 h-3 text-blue-500" />
                    </button>
                )}
            </div>
        </div>
    )
}
