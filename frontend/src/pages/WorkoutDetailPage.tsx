import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock3, MessageSquare, Tags } from 'lucide-react'
import { workoutsApi } from '@/services/workouts'
import type { WorkoutHistoryItem } from '@/types/workouts'
import { useTelegramWebApp } from '@hooks/useTelegramWebApp'

const formatDate = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

export function WorkoutDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const tg = useTelegramWebApp()
    const [workout, setWorkout] = useState<WorkoutHistoryItem | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const workoutId = Number.parseInt(id ?? '', 10)

    useEffect(() => {
        if (tg.isTelegram) {
            tg.showBackButton(() => navigate('/workouts'))
        }
        return () => {
            tg.hideBackButton()
        }
    }, [tg, navigate])

    useEffect(() => {
        if (!Number.isFinite(workoutId)) {
            setError('Неверный идентификатор тренировки')
            setIsLoading(false)
            return
        }

        let isCancelled = false
        const loadWorkout = async () => {
            setIsLoading(true)
            setError(null)
            try {
                const response = await workoutsApi.getHistoryItem(workoutId)
                if (!isCancelled) {
                    setWorkout(response)
                }
            } catch (loadError) {
                console.error('Failed to load workout detail:', loadError)
                if (!isCancelled) {
                    setError('Не удалось загрузить детали тренировки')
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false)
                }
            }
        }

        loadWorkout()
        return () => {
            isCancelled = true
        }
    }, [workoutId])

    const exerciseCount = useMemo(
        () => workout?.exercises.length ?? 0,
        [workout]
    )

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate('/workouts')}
                    className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Детали тренировки</h1>
            </div>

            {isLoading && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
            )}

            {!isLoading && error && (
                <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
            )}

            {!isLoading && !error && workout && (
                <>
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <CalendarDays className="w-4 h-4" />
                            <span>{formatDate(workout.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Clock3 className="w-4 h-4" />
                            <span>{workout.duration ?? 0} мин</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Упражнений: {exerciseCount}
                        </div>
                        {workout.comments && (
                            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <MessageSquare className="w-4 h-4 mt-0.5" />
                                <span>{workout.comments}</span>
                            </div>
                        )}
                        {workout.tags.length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <Tags className="w-4 h-4 mt-0.5" />
                                <span>{workout.tags.join(', ')}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {workout.exercises.map((exercise) => (
                            <div
                                key={`${exercise.exercise_id}-${exercise.name}`}
                                className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4"
                            >
                                <h2 className="font-semibold text-gray-900 dark:text-white">{exercise.name}</h2>
                                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                    {exercise.sets_completed.map((set) => (
                                        <div key={set.set_number}>
                                            Подход {set.set_number}: {set.reps ?? '-'} повторений, {set.weight ?? '-'} кг
                                            {typeof set.duration === 'number' ? `, ${set.duration} сек` : ''}
                                            {set.completed ? ' (выполнен)' : ' (не выполнен)'}
                                        </div>
                                    ))}
                                </div>
                                {exercise.notes && (
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{exercise.notes}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
