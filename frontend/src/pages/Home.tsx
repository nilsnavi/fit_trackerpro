import { Activity, Flame, Timer, TrendingUp } from 'lucide-react'
import { useTelegramWebApp } from '@hooks/useTelegramWebApp'
import { useEffect, useState } from 'react'

interface UserStats {
    calories: number
    workouts: number
    activity: number
    progress: number
}

const defaultStats: UserStats = {
    calories: 2450,
    workouts: 5,
    activity: 45,
    progress: 12
}

const recentWorkouts = [
    { id: 1, title: 'Утренняя пробежка', duration: '30 мин', calories: 320, date: 'Сегодня' },
    { id: 2, title: 'Силовая тренировка', duration: '45 мин', calories: 280, date: 'Вчера' },
    { id: 3, title: 'Йога', duration: '60 мин', calories: 180, date: '2 дня назад' },
]

export function Home() {
    const tg = useTelegramWebApp()
    const [stats] = useState<UserStats>(defaultStats)

    // Get user name from Telegram or use default
    const userName = tg.user?.first_name || tg.user?.username || 'Атлет'
    const userInitial = userName?.[0]?.toUpperCase() || 'F'
    const userPhoto = tg.user?.photo_url

    // Initialize and sync with Telegram on mount
    useEffect(() => {
        if (tg.isTelegram) {
            // Set up main button for quick workout start
            tg.showMainButton('Начать тренировку', () => {
                tg.hapticFeedback({ type: 'impact', style: 'medium' })
                // Navigate to workout builder
                window.location.href = '/workouts/builder'
            })
        }

        return () => {
            tg.hideMainButton()
        }
    }, [tg])

    // Handle quick action with haptic feedback
    const handleQuickAction = (action: string) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })

        switch (action) {
            case 'workout':
                // Navigate to workout
                window.location.href = '/workouts'
                break
            case 'metric':
                // Navigate to health
                window.location.href = '/health'
                break
        }
    }

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Доброе утро'
        if (hour < 18) return 'Добрый день'
        return 'Добрый вечер'
    }

    return (
        <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {getGreeting()}, {userName}!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Готов достичь своих целей сегодня?
                    </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                    {userPhoto ? (
                        <img src={userPhoto} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                        userInitial
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Калории</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.calories.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ккал</div>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <Timer className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Тренировки</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.workouts}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">на этой неделе</div>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Активность</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activity}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">минут</div>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Прогресс</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">+{stats.progress}%</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">к прошлой неделе</div>
                </div>
            </div>

            {/* Recent Workouts */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Недавние тренировки</h2>
                    <button
                        className="text-primary text-sm"
                        onClick={() => {
                            tg.hapticFeedback({ type: 'selection' })
                            window.location.href = '/workouts'
                        }}
                    >
                        Все
                    </button>
                </div>
                <div className="space-y-3">
                    {recentWorkouts.map((workout) => (
                        <div
                            key={workout.id}
                            className="bg-gray-50 dark:bg-neutral-800 flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
                            onClick={() => tg.hapticFeedback({ type: 'impact', style: 'light' })}
                        >
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">{workout.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{workout.date}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{workout.duration}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{workout.calories} ккал</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Быстрые действия</h2>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        className="bg-primary text-white flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium active:scale-[0.98] transition-transform"
                        onClick={() => handleQuickAction('workout')}
                    >
                        <Activity className="w-5 h-5" />
                        Записать тренировку
                    </button>
                    <button
                        className="bg-gray-100 dark:bg-neutral-700 text-gray-900 dark:text-white flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors active:scale-[0.98]"
                        onClick={() => handleQuickAction('metric')}
                    >
                        <TrendingUp className="w-5 h-5" />
                        Записать метрику
                    </button>
                </div>
            </div>

            {/* Telegram Platform Info */}
            {tg.isTelegram && (
                <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4">
                    Telegram WebApp v{tg.webApp?.version} • {tg.webApp?.platform}
                </div>
            )}
        </div>
    )
}
