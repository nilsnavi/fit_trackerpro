/**
 * WorkoutSummary Component
 * 
 * Компонент отображения сводки тренировки.
 * Pure UI component.
 */

import { Clock, Dumbbell, TrendingUp, Award } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface WorkoutSummaryProps {
    totalDurationSeconds: number
    totalSetsCompleted: number
    totalVolume?: number
    exercisesCompleted: number
    personalRecords?: number
    className?: string
}

export function WorkoutSummary({
    totalDurationSeconds,
    totalSetsCompleted,
    totalVolume = 0,
    exercisesCompleted,
    personalRecords = 0,
    className,
}: WorkoutSummaryProps) {
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        
        if (hours > 0) {
            return `${hours}ч ${minutes}м`
        }
        return `${minutes} мин`
    }

    const formatVolume = (volume: number) => {
        if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)} т`
        }
        return `${Math.round(volume)} кг`
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Заголовок */}
            <div className="text-center">
                <h2 className="text-lg font-bold text-telegram-text">Сводка тренировки</h2>
                <p className="mt-1 text-sm text-telegram-hint">Отличная работа!</p>
            </div>

            {/* Основные метрики */}
            <div className="grid grid-cols-2 gap-3">
                {/* Длительность */}
                <div className="rounded-xl bg-telegram-secondary-bg p-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <p className="text-xs font-medium text-telegram-hint">Время</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-telegram-text">
                        {formatDuration(totalDurationSeconds)}
                    </p>
                </div>

                {/* Подходы */}
                <div className="rounded-xl bg-telegram-secondary-bg p-4">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="h-5 w-5 text-primary" />
                        <p className="text-xs font-medium text-telegram-hint">Подходы</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-telegram-text">
                        {totalSetsCompleted}
                    </p>
                </div>

                {/* Объем */}
                <div className="rounded-xl bg-telegram-secondary-bg p-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        <p className="text-xs font-medium text-telegram-hint">Объем</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-telegram-text">
                        {formatVolume(totalVolume)}
                    </p>
                </div>

                {/* Упражнения */}
                <div className="rounded-xl bg-telegram-secondary-bg p-4">
                    <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-orange-500" />
                        <p className="text-xs font-medium text-telegram-hint">Упражнения</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-telegram-text">
                        {exercisesCompleted}
                    </p>
                </div>
            </div>

            {/* Личные рекорды */}
            {personalRecords > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Award className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-telegram-text">
                                Новые личные рекорды!
                            </p>
                            <p className="text-xs text-telegram-hint">
                                {personalRecords} {personalRecords === 1 ? 'рекорд' : 'рекордов'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
