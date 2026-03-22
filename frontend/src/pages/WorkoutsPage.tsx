import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Clock, Flame, ChevronRight } from 'lucide-react'
import { useTelegramWebApp } from '@hooks/useTelegramWebApp'

type WorkoutType = 'cardio' | 'strength' | 'flexibility' | 'sports' | 'other'

const workoutTypes: { type: WorkoutType; label: string; color: string }[] = [
    { type: 'cardio', label: 'Кардио', color: 'bg-red-500' },
    { type: 'strength', label: 'Силовая', color: 'bg-blue-500' },
    { type: 'flexibility', label: 'Гибкость', color: 'bg-green-500' },
    { type: 'sports', label: 'Спорт', color: 'bg-purple-500' },
    { type: 'other', label: 'Другое', color: 'bg-gray-500' },
]

const mockWorkouts = [
    { id: 1, title: 'Утренняя пробежка', type: 'cardio' as WorkoutType, duration: 30, calories: 320, date: '2024-03-18' },
    { id: 2, title: 'Верхняя часть тела', type: 'strength' as WorkoutType, duration: 45, calories: 280, date: '2024-03-17' },
    { id: 3, title: 'Йога флоу', type: 'flexibility' as WorkoutType, duration: 60, calories: 180, date: '2024-03-16' },
    { id: 4, title: 'Баскетбол', type: 'sports' as WorkoutType, duration: 90, calories: 650, date: '2024-03-15' },
]

export function WorkoutsPage() {
    const [selectedType, setSelectedType] = useState<WorkoutType | 'all'>('all')
    const tg = useTelegramWebApp()
    const navigate = useNavigate()

    const filteredWorkouts = selectedType === 'all'
        ? mockWorkouts
        : mockWorkouts.filter(w => w.type === selectedType)

    // Set up Telegram back button
    useEffect(() => {
        if (tg.isTelegram) {
            tg.setHeaderColor('bg_color')
            tg.setBackgroundColor('bg_color')
        }
    }, [tg])

    // Handle filter change with haptic feedback
    const handleFilterChange = (type: WorkoutType | 'all') => {
        tg.hapticFeedback({ type: 'selection' })
        setSelectedType(type)
    }

    // Handle add new workout
    const handleAddWorkout = () => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        navigate('/workouts/builder')
    }

    // Handle workout click
    const handleWorkoutClick = (workoutId: number) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })
        // Navigate to workout details
        console.log('Workout clicked:', workoutId)
    }

    return (
        <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Тренировки</h1>
                <button
                    className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center active:scale-95 transition-transform"
                    onClick={handleAddWorkout}
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                    onClick={() => handleFilterChange('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedType === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
                        }`}
                >
                    Все
                </button>
                {workoutTypes.map(({ type, label }) => (
                    <button
                        key={type}
                        onClick={() => handleFilterChange(type)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedType === type
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Weekly Summary */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">На этой неделе</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">5</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Тренировок</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">285</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Минут</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">2.4k</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ккал</div>
                    </div>
                </div>
            </div>

            {/* Workouts List */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Недавние</h2>
                {filteredWorkouts.map((workout) => {
                    const typeInfo = workoutTypes.find(t => t.type === workout.type)
                    return (
                        <div
                            key={workout.id}
                            className="bg-gray-50 dark:bg-neutral-800 flex items-center gap-4 p-4 rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
                            onClick={() => handleWorkoutClick(workout.id)}
                        >
                            <div className={`w-12 h-12 rounded-xl ${typeInfo?.color || 'bg-gray-500'} flex items-center justify-center text-white`}>
                                <Dumbbell className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{workout.title}</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {workout.duration} мин
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Flame className="w-3 h-3" />
                                        {workout.calories} ккал
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
