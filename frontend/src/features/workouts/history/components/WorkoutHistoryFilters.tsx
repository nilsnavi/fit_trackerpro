import { Calendar, Filter } from 'lucide-react'
import type { WorkoutHistoryFilterType, WorkoutHistoryDatePreset } from '@features/workouts/hooks/useWorkoutHistoryInfinite'
import { WORKOUT_FILTER_TYPE_ORDER, getWorkoutListTypeConfig } from '@features/workouts/config/workoutTypeConfigs'
import type { WorkoutType } from '@shared/types'
import { cn } from '@shared/lib/cn'

interface WorkoutHistoryFiltersProps {
    selectedType: WorkoutHistoryFilterType
    onTypeChange: (type: WorkoutHistoryFilterType) => void
    datePreset: WorkoutHistoryDatePreset
    onDatePresetChange: (preset: WorkoutHistoryDatePreset) => void
}

export function WorkoutHistoryFilters({
    selectedType,
    onTypeChange,
    datePreset,
    onDatePresetChange,
}: WorkoutHistoryFiltersProps) {
    return (
        <div className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4">
            {/* Заголовок фильтров */}
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-telegram-hint" />
                <h2 className="text-sm font-semibold text-telegram-text">Фильтры</h2>
            </div>

            {/* Фильтр по типу тренировки */}
            <div>
                <p className="mb-2 text-xs font-medium text-telegram-hint">Тип тренировки</p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        type="button"
                        onClick={() => onTypeChange('all')}
                        className={cn(
                            'shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors',
                            selectedType === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        )}
                    >
                        Все
                    </button>
                    {WORKOUT_FILTER_TYPE_ORDER.map((type: WorkoutType) => {
                        const config = getWorkoutListTypeConfig(type)
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => onTypeChange(type as WorkoutHistoryFilterType)}
                                className={cn(
                                    'shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors',
                                    selectedType === (type as WorkoutHistoryFilterType)
                                        ? 'bg-primary text-white'
                                        : 'bg-telegram-bg text-telegram-text'
                                )}
                            >
                                {config.filterLabel}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Фильтр по периоду */}
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-telegram-hint" />
                    <p className="text-xs font-medium text-telegram-hint">Период</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => onDatePresetChange('all')}
                        className={cn(
                            'rounded-xl px-3 py-2.5 text-xs font-medium transition-colors',
                            datePreset === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        )}
                    >
                        Все время
                    </button>
                    <button
                        type="button"
                        onClick={() => onDatePresetChange('week')}
                        className={cn(
                            'rounded-xl px-3 py-2.5 text-xs font-medium transition-colors',
                            datePreset === 'week'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        )}
                    >
                        Неделя
                    </button>
                    <button
                        type="button"
                        onClick={() => onDatePresetChange('month')}
                        className={cn(
                            'rounded-xl px-3 py-2.5 text-xs font-medium transition-colors',
                            datePreset === 'month'
                                ? 'bg-primary text-white'
                                : 'bg-telegram-bg text-telegram-text'
                        )}
                    >
                        Месяц
                    </button>
                </div>
            </div>
        </div>
    )
}
