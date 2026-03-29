import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock3, MessageSquare, Tags } from 'lucide-react'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { getErrorMessage } from '@shared/errors'

const formatDate = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

const formatDurationMinutes = (duration?: number): string => {
    if (typeof duration !== 'number' || duration <= 0) {
        return '—'
    }
    return `${duration} мин`
}

const formatSetValue = (value?: number, unit?: string): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—'
    }
    return unit ? `${value} ${unit}` : `${value}`
}

export function WorkoutDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const tg = useTelegramWebApp()

    const workoutId = Number.parseInt(id ?? '', 10)
    const isValidWorkoutId = Number.isFinite(workoutId)

    const {
        data: workout,
        isFetching,
        isError,
        error: queryError,
    } = useWorkoutHistoryItemQuery(workoutId, isValidWorkoutId)

    useEffect(() => {
        if (tg.isTelegram) {
            tg.showBackButton(() => navigate('/workouts'))
        }
        return () => {
            tg.hideBackButton()
        }
    }, [tg, navigate])

    const errorMessage = !isValidWorkoutId
        ? 'Неверный идентификатор тренировки'
        : isError
            ? getErrorMessage(queryError)
            : null

    const isLoading = isValidWorkoutId && isFetching

    const exerciseCount = useMemo(
        () => workout?.exercises.length ?? 0,
        [workout]
    )

    const completedSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => (
            acc + exercise.sets_completed.filter((set) => set.completed).length
        ), 0)
    }, [workout])

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

            {!isLoading && errorMessage && (
                <div className="text-sm text-red-500 dark:text-red-400">{errorMessage}</div>
            )}

            {!isLoading && !errorMessage && workout && (
                <>
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <CalendarDays className="w-4 h-4" />
                            <span>{formatDate(workout.date)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2">
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    <span>Длительность</span>
                                </div>
                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {formatDurationMinutes(workout.duration)}
                                </div>
                            </div>
                            <div className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Упражнения</div>
                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {exerciseCount}
                                </div>
                            </div>
                            <div className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Подходы</div>
                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {completedSetCount}
                                </div>
                            </div>
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
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="font-semibold text-gray-900 dark:text-white">{exercise.name}</h2>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                        #{exercise.exercise_id}
                                    </span>
                                </div>

                                <div className="mt-2 space-y-2">
                                    {exercise.sets_completed.map((set) => (
                                        <div
                                            key={set.set_number}
                                            className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2 text-sm text-gray-700 dark:text-gray-300"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">Подход {set.set_number}</span>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs ${set.completed
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                        : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                                                        }`}
                                                >
                                                    {set.completed ? 'Выполнен' : 'Не выполнен'}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                    Повторы: {formatSetValue(set.reps, 'повт')}
                                                </span>
                                                <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                    Вес: {formatSetValue(set.weight, 'кг')}
                                                </span>
                                                <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                    RPE: {formatSetValue(set.rpe)}
                                                </span>
                                                <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                    RIR: {formatSetValue(set.rir)}
                                                </span>
                                                <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                    Время: {formatSetValue(set.duration, 'сек')}
                                                </span>
                                            </div>
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
