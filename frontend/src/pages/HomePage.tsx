import { Activity, Flame, Timer, TrendingUp } from 'lucide-react'

const stats = [
    { icon: Flame, label: 'Калории', value: '2,450', unit: 'ккал', color: 'text-orange-500' },
    { icon: Timer, label: 'Тренировки', value: '5', unit: 'на этой неделе', color: 'text-blue-500' },
    { icon: Activity, label: 'Активность', value: '45', unit: 'минут', color: 'text-green-500' },
    { icon: TrendingUp, label: 'Прогресс', value: '+12%', unit: 'к прошлой неделе', color: 'text-purple-500' },
]

const recentWorkouts = [
    { id: 1, title: 'Утренняя пробежка', duration: '30 мин', calories: 320, date: 'Сегодня' },
    { id: 2, title: 'Силовая тренировка', duration: '45 мин', calories: 280, date: 'Вчера' },
    { id: 3, title: 'Йога', duration: '60 мин', calories: 180, date: '2 дня назад' },
]

export function HomePage() {
    return (
        <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Привет, Атлет!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Готов достичь своих целей сегодня?
                    </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                    F
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {stats.map(({ icon: Icon, label, value, unit, color }) => (
                    <div key={label} className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-5 h-5 ${color}`} />
                            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{unit}</div>
                    </div>
                ))}
            </div>

            {/* Recent Workouts */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Недавние тренировки</h2>
                    <button className="text-primary text-sm">Все</button>
                </div>
                <div className="space-y-3">
                    {recentWorkouts.map((workout) => (
                        <div key={workout.id} className="bg-gray-50 dark:bg-neutral-800 flex items-center justify-between p-4 rounded-xl transition-colors">
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
                    <button className="bg-primary text-white flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium">
                        <Activity className="w-5 h-5" />
                        Записать тренировку
                    </button>
                    <button className="bg-gray-100 dark:bg-neutral-700 text-gray-900 dark:text-white flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors">
                        <TrendingUp className="w-5 h-5" />
                        Записать метрику
                    </button>
                </div>
            </div>
        </div>
    )
}
