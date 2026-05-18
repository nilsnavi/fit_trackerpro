/**
 * ExerciseCard Component
 * 
 * Карточка упражнения в активной тренировке.
 * Pure UI component без бизнес-логики.
 */

import { Dumbbell, ChevronRight } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { CompletedExercise } from '@features/workouts/types/workouts'

interface ExerciseCardProps {
    exercise: CompletedExercise
    isActive?: boolean
    isCompleted?: boolean
    onClick?: () => void
    className?: string
}

export function ExerciseCard({
    exercise,
    isActive = false,
    isCompleted = false,
    onClick,
    className,
}: ExerciseCardProps) {
    const completedSets = exercise.sets_completed?.length || 0
    // TODO: получить totalSets из шаблона или метаданных упражнения
    const totalSets = 4 // Временное значение

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'w-full rounded-xl border bg-telegram-secondary-bg p-4 text-left transition-all',
                isActive && 'border-primary ring-2 ring-primary/20',
                isCompleted && 'opacity-75',
                onClick && 'hover:bg-telegram-bg',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                {/* Иконка упражнения */}
                <div
                    className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-lg',
                        isActive ? 'bg-primary/10 text-primary' : 'bg-telegram-bg text-telegram-hint',
                    )}
                >
                    <Dumbbell className="h-6 w-6" />
                </div>

                {/* Информация об упражнении */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-telegram-text truncate">
                            {exercise.name}
                        </h3>
                        {isActive && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Активно
                            </span>
                        )}
                    </div>

                    <p className="mt-1 text-xs text-telegram-hint">
                        Тренировка
                    </p>

                    {/* Прогресс подходов */}
                    <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-telegram-bg overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all',
                                    isCompleted ? 'bg-success' : 'bg-primary',
                                )}
                                style={{
                                    width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                                }}
                            />
                        </div>
                        <span className="text-xs font-medium text-telegram-hint shrink-0">
                            {completedSets}/{totalSets}
                        </span>
                    </div>
                </div>

                {/* Стрелка */}
                {onClick && (
                    <ChevronRight className="h-5 w-5 text-telegram-hint shrink-0" />
                )}
            </div>
        </button>
    )
}
