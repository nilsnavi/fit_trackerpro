import { Activity, Flame, Timer, TrendingUp, ChevronRight, Clock } from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { getWorkoutListTypeConfig } from '@features/workouts/config/workoutTypeConfigs'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { WorkoutsHistoryBlockSkeleton } from '@shared/ui/page-skeletons'

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

export function Home() {
    const tg = useTelegramWebApp()
    const navigate = useNavigate()
    const [stats] = useState<UserStats>(defaultStats)
    const { data: workoutHistory, isLoading: historyLoading } = useWorkoutHistoryQuery()

    const recentWorkouts = useMemo(() => {
        const items = (workoutHistory?.items ?? []).map(toWorkoutListItem).slice(0, 3)
        return items
    }, [workoutHistory])

    const formatRecentDate = (isoDate: string) => {
        const d = new Date(isoDate)
        if (Number.isNaN(d.getTime())) return ''
        const now = new Date()
        const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
        const diff = dayStart(now) - dayStart(d)
        if (diff === 0) return 'Сегодня'
        if (diff === 86400000) return 'Вчера'
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    }

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
                navigate('/workouts/builder')
            })
        }

        return () => {
            tg.hideMainButton()
        }
    }, [tg.isTelegram, navigate, tg.showMainButton, tg.hideMainButton])

    // Handle quick action with haptic feedback
    const handleQuickAction = (action: string) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })

        switch (action) {
            case 'workout':
                navigate('/workouts')
                break
            case 'metric':
                navigate('/health')
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
                            navigate('/workouts')
                        }}
                    >
                        Все
                    </button>
                </div>
                {historyLoading ? (
                    <WorkoutsHistoryBlockSkeleton />
                ) : recentWorkouts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 dark:border-neutral-700 dark:bg-neutral-900/40">
                        <SectionEmptyState
                            icon={Activity}
                            compact
                            title="Нет недавних тренировок"
                            description="Как только вы завершите первую сессию, она появится здесь и в списке на экране «Тренировки»."
                            primaryAction={{
                                label: 'Перейти к тренировкам',
                                onClick: () => {
                                    tg.hapticFeedback({ type: 'selection' })
                                    navigate('/workouts')
                                },
                            }}
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentWorkouts.map((workout) => {
                            const listCfg = getWorkoutListTypeConfig(workout.type)
                            const TypeIcon = listCfg.icon
                            const showCals = listCfg.ux.showCaloriesInSummary
                            return (
                                <div
                                    key={workout.id}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            navigate(`/workouts/${workout.id}`)
                                        }
                                    }}
                                    className="bg-gray-50 dark:bg-neutral-800 flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-colors active:scale-[0.98]"
                                    onClick={() => {
                                        tg.hapticFeedback({ type: 'impact', style: 'light' })
                                        navigate(`/workouts/${workout.id}`)
                                    }}
                                >
                                    <div
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${listCfg.listBadgeClass} text-white`}
                                    >
                                        <TypeIcon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-medium text-gray-900 dark:text-white">{workout.title}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            <span>{formatRecentDate(workout.date)}</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {workout.duration} мин
                                            </span>
                                            {showCals && (
                                                <span>
                                                    {workout.calories} ккал
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
                                </div>
                            )
                        })}
                    </div>
                )}
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
