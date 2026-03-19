import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, RefreshCw, Calendar, BarChart3, BookOpen, Settings, ChevronRight } from 'lucide-react'
import { useTelegram } from '@hooks/useTelegram'
import { useHomeStore } from '@stores/homeStore'
import { cn } from '@utils/cn'

// Виджеты
import { GlucoseWidget } from '@components/home/GlucoseWidget'
import { WellnessWidget } from '@components/home/WellnessWidget'
import { WaterWidget } from '@components/home/WaterWidget'
import { WorkoutCard } from '@components/home/WorkoutCard'
import { EmergencyButton } from '@components/home/EmergencyButton'

// Элементы быстрого доступа
const quickActions = [
    { id: 'progress', label: 'Прогресс', icon: BarChart3, color: 'from-blue-500 to-blue-600' },
    { id: 'calendar', label: 'Календарь', icon: Calendar, color: 'from-green-500 to-green-600' },
    { id: 'catalog', label: 'Каталог', icon: BookOpen, color: 'from-orange-500 to-orange-600' },
    { id: 'settings', label: 'Настройки', icon: Settings, color: 'from-purple-500 to-purple-600' },
]

export function Home() {
    const { user, hapticFeedback } = useTelegram()
    const {
        userName,
        avatarUrl,
        glucose,
        wellness,
        water,
        workoutTemplates,
        isRefreshing,
        lastUpdated,
        setUserName,
        setAvatarUrl,
        addWater,
        refreshData
    } = useHomeStore()

    // Состояние pull-to-refresh
    const [pullDistance, setPullDistance] = useState(0)
    const [isPulling, setIsPulling] = useState(false)
    const touchStartY = useRef(0)
    const containerRef = useRef<HTMLDivElement>(null)

    // Установка данных пользователя из Telegram
    useEffect(() => {
        if (user) {
            setUserName(user.first_name || user.username || 'Атлет')
            if (user.photo_url) {
                setAvatarUrl(user.photo_url)
            }
        }
    }, [user, setUserName, setAvatarUrl])

    // Начальная загрузка данных
    useEffect(() => {
        if (!lastUpdated) {
            refreshData()
        }
    }, [lastUpdated, refreshData])

    // Обработчики pull-to-refresh
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY
            setIsPulling(true)
        }
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling) return

        const touchY = e.touches[0].clientY
        const diff = touchY - touchStartY.current

        if (diff > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
            // Применение сопротивления
            const resistance = 0.5
            setPullDistance(Math.min(diff * resistance, 100))
        }
    }, [isPulling])

    const handleTouchEnd = useCallback(() => {
        if (pullDistance > 60) {
            hapticFeedback.medium()
            refreshData()
        }
        setIsPulling(false)
        setPullDistance(0)
    }, [pullDistance, refreshData, hapticFeedback])

    // Обработчики
    const handleStartWorkout = (id: string) => {
        hapticFeedback.medium()
        console.log('Starting workout:', id)
        // Переход к экрану тренировки
    }

    const handleWorkoutClick = (id: string) => {
        hapticFeedback.light()
        console.log('Workout details:', id)
        // Переход к деталям тренировки
    }

    const handleQuickAction = (id: string) => {
        hapticFeedback.light()
        console.log('Quick action:', id)
        // Переход к соответствующему экрану
    }

    const handleAddWater = (amount: number) => {
        hapticFeedback.success()
        addWater(amount)
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Доброе утро'
        if (hour < 18) return 'Добрый день'
        return 'Добрый вечер'
    }

    return (
        <div className="relative min-h-screen bg-telegram-bg">
            {/* Pull to refresh indicator */}
            <div
                className="fixed top-0 left-0 right-0 z-30 flex items-center justify-center pointer-events-none"
                style={{
                    transform: `translateY(${Math.max(pullDistance - 50, 0)}px)`,
                    opacity: Math.min(pullDistance / 60, 1)
                }}
            >
                <div className="bg-telegram-secondary-bg rounded-full p-3 shadow-lg">
                    <RefreshCw className={cn(
                        'w-6 h-6 text-telegram-text',
                        isRefreshing && 'animate-spin'
                    )} />
                </div>
            </div>

            {/* Main scrollable content */}
            <div
                ref={containerRef}
                className="h-screen overflow-y-auto no-scrollbar pb-32"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out'
                }}
            >
                <div className="p-4 space-y-6 animate-fade-in">
                    {/* Header */}
                    <header className="flex items-center justify-between safe-area-top">
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="relative">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={userName}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-telegram-secondary-bg"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-telegram-button flex items-center justify-center text-white font-bold text-lg">
                                        {userName?.[0]?.toUpperCase() || 'F'}
                                    </div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-telegram-bg" />
                            </div>

                            {/* Greeting */}
                            <div>
                                <p className="text-sm text-telegram-hint">{getGreeting()}</p>
                                <h1 className="text-lg font-bold text-telegram-text">{userName}</h1>
                            </div>
                        </div>

                        {/* Notification button */}
                        <button
                            onClick={() => hapticFeedback.light()}
                            className="w-10 h-10 rounded-full bg-telegram-secondary-bg flex items-center justify-center active:scale-95 transition-transform"
                        >
                            <Bell className="w-5 h-5 text-telegram-text" />
                        </button>
                    </header>

                    {/* Status Widgets - Horizontal Scroll */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-telegram-text">Состояние</h2>
                            <button className="text-sm text-telegram-link flex items-center gap-1">
                                Все
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
                            <GlucoseWidget
                                data={glucose}
                                onClick={() => console.log('Glucose widget clicked')}
                            />
                            <WellnessWidget
                                data={wellness}
                                onClick={() => console.log('Wellness widget clicked')}
                            />
                            <WaterWidget
                                data={water}
                                onAddWater={handleAddWater}
                                onClick={() => console.log('Water widget clicked')}
                            />
                        </div>
                    </section>

                    {/* Workout Cards */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-telegram-text">Тренировки</h2>
                            <button className="text-sm text-telegram-link flex items-center gap-1">
                                Все
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {workoutTemplates.map((template) => (
                                <WorkoutCard
                                    key={template.id}
                                    template={template}
                                    onStart={handleStartWorkout}
                                    onClick={handleWorkoutClick}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-lg font-semibold text-telegram-text mb-3">Быстрый доступ</h2>
                        <div className="grid grid-cols-4 gap-3">
                            {quickActions.map((action) => {
                                const Icon = action.icon
                                return (
                                    <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(action.id)}
                                        className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-telegram-secondary-bg active:scale-95 transition-transform"
                                    >
                                        <div className={cn(
                                            'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
                                            action.color
                                        )}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="text-xs text-telegram-text font-medium">
                                            {action.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </section>

                    {/* Last updated info */}
                    {lastUpdated && (
                        <p className="text-xs text-telegram-hint text-center">
                            Обновлено: {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
            </div>

            {/* Emergency Button - Sticky Bottom */}
            <EmergencyButton />
        </div>
    )
}
