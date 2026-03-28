import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Clock, Flame, ChevronRight } from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import {
    WORKOUT_FILTER_TYPE_ORDER,
    WORKOUT_MODE_ORDER,
    WORKOUT_TYPE_CONFIGS,
    estimateCaloriesForType,
    getWorkoutListTypeConfig,
    type WorkoutMode,
} from '@/features/workouts/config/workoutTypeConfigs'
import { useWorkoutHistoryQuery } from '@/features/workouts/hooks/useWorkoutHistoryQuery'
import type { WorkoutType } from '@shared/types'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { getErrorMessage } from '@shared/errors'

interface WorkoutListItem {
    id: number
    title: string
    type: WorkoutType
    duration: number
    calories: number
    date: string
}

const detectWorkoutType = (item: WorkoutHistoryItem): WorkoutType => {
    const tags = item.tags.map((tag) => tag.toLowerCase())

    if (tags.includes('sports') || tags.includes('sport')) return 'sports'
    if (tags.includes('cardio')) return 'cardio'
    if (tags.includes('strength')) return 'strength'
    if (tags.includes('flexibility') || tags.includes('yoga')) return 'flexibility'

    const hasReps = item.exercises.some((exercise) =>
        exercise.sets_completed.some((set) => typeof set.reps === 'number' && set.reps > 0)
    )
    const hasDurationOnly = item.exercises.some((exercise) =>
        exercise.sets_completed.some((set) => typeof set.duration === 'number' && !set.reps)
    )

    if (hasDurationOnly && !hasReps) return 'cardio'
    if (hasReps) return 'strength'

    return 'other'
}

const toWorkoutListItem = (item: WorkoutHistoryItem): WorkoutListItem => {
    const duration = item.duration ?? 0
    const type = detectWorkoutType(item)
    const firstExerciseName = item.exercises[0]?.name
    const title = item.comments?.trim() || firstExerciseName || `Тренировка #${item.id}`

    return {
        id: item.id,
        title,
        type,
        duration,
        calories: estimateCaloriesForType(type, duration),
        date: item.date,
    }
}

export function WorkoutsPage() {
    const [selectedType, setSelectedType] = useState<WorkoutType | 'all'>('all')
    const tg = useTelegramWebApp()
    const navigate = useNavigate()
    const {
        data: workoutHistory,
        isLoading,
        error,
    } = useWorkoutHistoryQuery()

    const workouts = useMemo(
        () => (workoutHistory?.items ?? []).map(toWorkoutListItem),
        [workoutHistory],
    )

    const filteredWorkouts = useMemo(
        () => (selectedType === 'all'
            ? workouts
            : workouts.filter(w => w.type === selectedType)),
        [selectedType, workouts]
    )

    const weeklySummary = useMemo(() => {
        const now = new Date()
        const weekAgo = new Date(now)
        weekAgo.setDate(now.getDate() - 7)

        const weekWorkouts = workouts.filter((workout) => {
            const workoutDate = new Date(workout.date)
            return workoutDate >= weekAgo && workoutDate <= now
        })

        const totalMinutes = weekWorkouts.reduce((acc, workout) => acc + workout.duration, 0)
        const totalCalories = weekWorkouts.reduce((acc, workout) => acc + workout.calories, 0)

        return {
            count: weekWorkouts.length,
            totalMinutes,
            totalCalories,
        }
    }, [workouts])

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

    const handleOpenMode = (mode: WorkoutMode) => {
        tg.hapticFeedback({ type: 'selection' })
        navigate(`/workouts/mode/${mode}`)
    }

    // Handle workout click
    const handleWorkoutClick = (workoutId: number) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })
        navigate(`/workouts/${workoutId}`)
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
                {WORKOUT_FILTER_TYPE_ORDER.map((type) => (
                    <button
                        key={type}
                        onClick={() => handleFilterChange(type)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedType === type
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
                            }`}
                    >
                        {getWorkoutListTypeConfig(type).filterLabel}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Режимы тренировки</h2>
                <div className="grid grid-cols-2 gap-3">
                    {WORKOUT_MODE_ORDER.map((mode) => {
                        const modeConfig = WORKOUT_TYPE_CONFIGS[mode]
                        const ModeIcon = modeConfig.icon
                        return (
                            <button
                                key={mode}
                                onClick={() => handleOpenMode(mode)}
                                className={`rounded-xl bg-gradient-to-br ${modeConfig.themeClass} p-4 text-left text-white active:scale-[0.98] transition-transform`}
                            >
                                <ModeIcon className="mb-3 h-5 w-5" />
                                <div className="font-semibold">{modeConfig.title}</div>
                                <div className="mt-1 text-xs text-white/85">{modeConfig.subtitle}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Weekly Summary */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">На этой неделе</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{weeklySummary.count}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Тренировок</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{weeklySummary.totalMinutes}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Минут</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{weeklySummary.totalCalories}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ккал</div>
                    </div>
                </div>
            </div>

            {/* Workouts List */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Недавние</h2>
                {isLoading && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Загрузка тренировок...
                    </div>
                )}
                {!isLoading && error && (
                    <div className="text-sm text-red-500 dark:text-red-400">
                        {getErrorMessage(error)}
                    </div>
                )}
                {!isLoading && !error && filteredWorkouts.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedType === 'all'
                            ? 'Тренировок пока нет'
                            : (getWorkoutListTypeConfig(selectedType).hints.emptyHistory ?? 'Нет тренировок этого типа')}
                    </div>
                )}
                {!isLoading && !error && filteredWorkouts.map((workout) => {
                    const listCfg = getWorkoutListTypeConfig(workout.type)
                    const TypeIcon = listCfg.icon
                    const showCals = listCfg.ux.showCaloriesInSummary
                    return (
                        <div
                            key={workout.id}
                            className="bg-gray-50 dark:bg-neutral-800 flex items-center gap-4 p-4 rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
                            onClick={() => handleWorkoutClick(workout.id)}
                        >
                            <div className={`w-12 h-12 rounded-xl ${listCfg.listBadgeClass} flex items-center justify-center text-white`}>
                                <TypeIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{workout.title}</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {workout.duration} мин
                                    </span>
                                    {showCals && (
                                        <span className="flex items-center gap-1">
                                            <Flame className="w-3 h-3" />
                                            {workout.calories} ккал
                                        </span>
                                    )}
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
