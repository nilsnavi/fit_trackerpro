import { useMemo } from 'react'
import { ChevronRight, Clock, Dumbbell, Flame, Repeat } from 'lucide-react'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { cn } from '@shared/lib/cn'
import { getWorkoutListTypeConfig } from '@features/workouts/config/workoutTypeConfigs'

interface WorkoutHistoryCardProps {
    workout: WorkoutHistoryItem
    onNavigate: (id: number) => void
    onRepeat?: (workout: WorkoutHistoryItem) => void
}

export function WorkoutHistoryCard({ workout, onNavigate, onRepeat }: WorkoutHistoryCardProps) {
    const config = useMemo(() => {
        // Определяем тип тренировки на основе комментариев или тегов
        const type = workout.tags?.[0] || 'custom'
        return getWorkoutListTypeConfig(type as any)
    }, [workout.tags])

    const TypeIcon = config.icon

    // Вычисляем метрики тренировки
    const metrics = useMemo(() => {
        const totalSets = workout.exercises.reduce(
            (sum, exercise) => sum + exercise.sets_completed.filter((set) => set.completed).length,
            0
        )

        let totalVolume = 0
        workout.exercises.forEach((exercise) => {
            exercise.sets_completed.forEach((set) => {
                if (set.completed && set.weight && set.reps) {
                    totalVolume += set.weight * set.reps
                }
            })
        })

        const duration = workout.duration ?? 0
        const sessionMetrics = workout.session_metrics

        return {
            totalSets,
            totalVolume,
            duration,
            avgRpe: sessionMetrics?.avg_rpe,
            volumePerMinute: sessionMetrics?.volume_per_minute,
        }
    }, [workout.exercises, workout.duration, workout.session_metrics])

    const formattedDate = useMemo(() => {
        const date = new Date(workout.date)
        return new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(date)
    }, [workout.date])

    const isCompleted = metrics.duration > 0

    return (
        <div className="group rounded-2xl bg-telegram-secondary-bg transition-all active:scale-[0.98]">
            {/* Основная карточка - клик для навигации */}
            <button
                type="button"
                onClick={() => onNavigate(workout.id)}
                className="flex w-full flex-col p-4 text-left"
            >
                <div className="flex items-start gap-3">
                    {/* Иконка типа тренировки */}
                    <div
                        className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white',
                            config.listBadgeClass
                        )}
                    >
                        <TypeIcon className="h-6 w-6" />
                    </div>

                    {/* Информация о тренировке */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="truncate text-base font-semibold text-telegram-text">
                                {workout.comments || `Тренировка #${workout.id}`}
                            </h3>
                            {!isCompleted && (
                                <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                                    В процессе
                                </span>
                            )}
                        </div>

                        {/* Дата и тип */}
                        <p className="mt-1 text-xs text-telegram-hint">{formattedDate}</p>

                        {/* Метрики */}
                        {isCompleted && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {/* Длительность */}
                                <div className="rounded-xl bg-telegram-bg/50 px-2 py-2">
                                    <div className="flex items-center gap-1 text-xs text-telegram-hint">
                                        <Clock className="h-3 w-3" />
                                        <span>Время</span>
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-telegram-text">
                                        {metrics.duration} мин
                                    </p>
                                </div>

                                {/* Количество подходов */}
                                <div className="rounded-xl bg-telegram-bg/50 px-2 py-2">
                                    <div className="flex items-center gap-1 text-xs text-telegram-hint">
                                        <Dumbbell className="h-3 w-3" />
                                        <span>Подходы</span>
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-telegram-text">
                                        {metrics.totalSets}
                                    </p>
                                </div>

                                {/* Общий объем */}
                                <div className="rounded-xl bg-telegram-bg/50 px-2 py-2">
                                    <div className="flex items-center gap-1 text-xs text-telegram-hint">
                                        <Flame className="h-3 w-3" />
                                        <span>Объем</span>
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-telegram-text">
                                        {metrics.totalVolume > 0
                                            ? `${(metrics.totalVolume / 1000).toFixed(1)}т`
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Стрелка навигации */}
                    <ChevronRight className="h-5 w-5 shrink-0 text-telegram-hint transition-transform group-active:translate-x-0.5" />
                </div>
            </button>

            {/* Кнопка "Повторить" */}
            {isCompleted && onRepeat && (
                <div className="border-t border-border/50 px-4 py-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onRepeat(workout)
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-medium text-primary transition-colors active:bg-primary/20"
                    >
                        <Repeat className="h-4 w-4" />
                        <span>Повторить тренировку</span>
                    </button>
                </div>
            )}
        </div>
    )
}
