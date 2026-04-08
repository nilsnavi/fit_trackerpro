import { memo } from 'react'
import { TrendingUp, Clock, BarChart3 } from 'lucide-react'
import type { ExerciseRestSettings } from '@features/workouts/types/workouts'

interface RestAnalyticsCardProps {
    exerciseName: string
    settings: ExerciseRestSettings | undefined
    globalDefaultSeconds: number
}

export const RestAnalyticsCard = memo(function RestAnalyticsCard({
    exerciseName,
    settings,
    globalDefaultSeconds,
}: RestAnalyticsCardProps) {
    if (!settings || settings.usage_count === 0) {
        return null
    }

    const isUsingCustom = !settings.use_global_default
    const currentRestTime = isUsingCustom ? settings.custom_rest_seconds : globalDefaultSeconds
    
    // Форматирование времени
    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}с`
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return remainingSeconds > 0 ? `${minutes}м ${remainingSeconds}с` : `${minutes}м`
    }

    // Определение тренда на основе последнего использованного времени
    const getTrendInfo = () => {
        if (!settings.last_used_seconds) return null
        
        const diff = settings.last_used_seconds - settings.custom_rest_seconds
        
        if (Math.abs(diff) <= 5) {
            return { 
                label: 'Стабильно', 
                icon: '→',
                color: 'text-green-600 dark:text-green-400',
                bgColor: 'bg-green-500/10 border-green-500/30'
            }
        } else if (diff > 0) {
            return { 
                label: 'Увеличивается', 
                icon: '↑',
                color: 'text-orange-600 dark:text-orange-400',
                bgColor: 'bg-orange-500/10 border-orange-500/30'
            }
        } else {
            return { 
                label: 'Сокращается', 
                icon: '↓',
                color: 'text-blue-600 dark:text-blue-400',
                bgColor: 'bg-blue-500/10 border-blue-500/30'
            }
        }
    }

    const trendInfo = getTrendInfo()

    return (
        <div className="rounded-xl border border-border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 p-4 space-y-3">
            {/* Заголовок */}
            <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-telegram-text">Аналитика отдыха</h3>
            </div>

            {/* Основная информация */}
            <div className="grid grid-cols-2 gap-3">
                {/* Текущее время отдыха */}
                <div className="rounded-lg bg-white/50 dark:bg-black/20 p-3">
                    <p className="text-xs text-telegram-hint mb-1">Текущее время</p>
                    <p className="text-2xl font-bold text-telegram-text tabular-nums">
                        {formatTime(currentRestTime)}
                    </p>
                    {isUsingCustom && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                            Персональное
                        </p>
                    )}
                </div>

                {/* Статистика использования */}
                <div className="rounded-lg bg-white/50 dark:bg-black/20 p-3">
                    <p className="text-xs text-telegram-hint mb-1">Использовано раз</p>
                    <p className="text-2xl font-bold text-telegram-text tabular-nums">
                        {settings.usage_count}
                    </p>
                    <p className="text-xs text-telegram-hint mt-1">
                        подходов
                    </p>
                </div>
            </div>

            {/* Последнее фактическое время */}
            {settings.last_used_seconds && (
                <div className="rounded-lg bg-white/50 dark:bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-telegram-hint mb-1">Последний отдых</p>
                            <p className="text-lg font-semibold text-telegram-text tabular-nums">
                                {formatTime(settings.last_used_seconds)}
                            </p>
                        </div>
                        {trendInfo && (
                            <div className={`px-3 py-2 rounded-lg border ${trendInfo.bgColor}`}>
                                <div className="flex items-center gap-1">
                                    <span className={`text-lg font-bold ${trendInfo.color}`}>
                                        {trendInfo.icon}
                                    </span>
                                    <span className={`text-xs font-medium ${trendInfo.color}`}>
                                        {trendInfo.label}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Рекомендация */}
            {settings.usage_count >= 5 && settings.last_used_seconds && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                    <div className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                                Рекомендация
                            </p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                На основе {settings.usage_count} тренировок оптимальное время отдыха: 
                                {' '}<strong>{formatTime(settings.last_used_seconds)}</strong>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
})

RestAnalyticsCard.displayName = 'RestAnalyticsCard'
