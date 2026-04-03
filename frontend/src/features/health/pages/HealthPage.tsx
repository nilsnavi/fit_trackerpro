import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus, ChevronRight } from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

type MetricType = 'weight' | 'steps' | 'heart_rate' | 'sleep' | 'water' | 'calories'

const metrics: { type: MetricType; label: string; unit: string; icon: string }[] = [
    { type: 'weight', label: 'Вес', unit: 'кг', icon: '⚖️' },
    { type: 'steps', label: 'Шаги', unit: 'шаг', icon: '👟' },
    { type: 'heart_rate', label: 'Пульс', unit: 'уд/мин', icon: '❤️' },
    { type: 'sleep', label: 'Сон', unit: 'ч', icon: '😴' },
    { type: 'water', label: 'Вода', unit: 'мл', icon: '💧' },
    { type: 'calories', label: 'Калории', unit: 'ккал', icon: '🔥' },
]

const mockData: Record<MetricType, { current: number; previous: number; target: number }> = {
    weight: { current: 75.5, previous: 76.2, target: 72.0 },
    steps: { current: 8432, previous: 10234, target: 10000 },
    heart_rate: { current: 72, previous: 70, target: 65 },
    sleep: { current: 7.2, previous: 6.8, target: 8.0 },
    water: { current: 1800, previous: 2200, target: 2500 },
    calories: { current: 2150, previous: 2300, target: 2200 },
}

export function HealthPage() {
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight')
    const tg = useTelegramWebApp()

    const getTrend = (current: number, previous: number) => {
        if (current > previous) return { icon: TrendingUp, color: 'text-green-500', sign: '+' }
        if (current < previous) return { icon: TrendingDown, color: 'text-red-500', sign: '' }
        return { icon: Minus, color: 'text-gray-500', sign: '' }
    }

    // Handle metric selection with haptic feedback
    const handleMetricSelect = (type: MetricType) => {
        tg.hapticFeedback({ type: 'selection' })
        setSelectedMetric(type)
    }

    // Handle quick log
    const handleQuickLog = (type: 'weight' | 'water') => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })

        // Show input dialog using Telegram API
        if (tg.isTelegram) {
            tg.showAlert(`Введите ${type === 'weight' ? 'вес' : 'количество воды'}`)
        }
    }

    return (
        <div className="p-4 space-y-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Отслеживайте свою статистику</p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
                {metrics.map(({ type, label, unit, icon }) => {
                    const data = mockData[type]
                    const trend = getTrend(data.current, data.previous)
                    const TrendIcon = trend.icon
                    const change = ((data.current - data.previous) / data.previous * 100).toFixed(1)

                    return (
                        <button
                            key={type}
                            onClick={() => handleMetricSelect(type)}
                            className={`bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl text-left transition-all active:scale-[0.98] ${selectedMetric === type ? 'ring-2 ring-primary' : ''
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-2xl">{icon}</span>
                                <div className={`flex items-center gap-1 text-xs ${trend.color}`}>
                                    <TrendIcon className="w-3 h-3" />
                                    <span>{trend.sign}{change}%</span>
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {data.current.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{unit}</div>
                            <div className="text-sm text-gray-900 dark:text-white mt-1">{label}</div>
                        </button>
                    )
                })}
            </div>

            {/* Selected Metric Detail */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        История: {metrics.find(m => m.type === selectedMetric)?.label}
                    </h2>
                    <button
                        className="text-primary text-sm flex items-center gap-1"
                        onClick={() => tg.hapticFeedback({ type: 'impact', style: 'light' })}
                    >
                        Все
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Mock Chart Placeholder */}
                <div className="h-40 bg-gray-100 dark:bg-neutral-700 rounded-xl flex items-end justify-between p-4 gap-2 transition-colors">
                    {[40, 65, 45, 80, 55, 70, 60].map((height, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-blue-500 rounded-t-lg transition-all"
                            style={{ height: `${height}%`, opacity: i === 6 ? 1 : 0.6 }}
                        />
                    ))}
                </div>

                <div className="flex justify-between mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Пн</span>
                    <span>Вт</span>
                    <span>Ср</span>
                    <span>Чт</span>
                    <span>Пт</span>
                    <span>Сб</span>
                    <span>Вс</span>
                </div>
            </div>

            {/* Quick Log */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Быстрый ввод</h2>
                <div className="flex gap-3">
                    <button
                        className="flex-1 bg-primary text-white flex items-center justify-center gap-2 py-3 rounded-xl font-medium active:scale-[0.98] transition-transform"
                        onClick={() => handleQuickLog('weight')}
                    >
                        <Plus className="w-5 h-5" />
                        Вес
                    </button>
                    <button
                        className="flex-1 bg-gray-100 dark:bg-neutral-700 text-gray-900 dark:text-white flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors active:scale-[0.98]"
                        onClick={() => handleQuickLog('water')}
                    >
                        <Plus className="w-5 h-5" />
                        Вода
                    </button>
                </div>
            </div>
        </div>
    )
}
