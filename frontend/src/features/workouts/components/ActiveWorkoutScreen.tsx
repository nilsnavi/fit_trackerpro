/**
 * ActiveWorkoutScreen Component
 * 
 * Главный экран активной тренировки.
 * Компонент-контейнер, который использует другие компоненты.
 */

import { useCallback } from 'react'
import { cn } from '@shared/lib/cn'
import { ExerciseCard } from './ExerciseCard'
import { SetTable } from './SetTable'
import { RestTimer } from './RestTimer'
import { CompleteWorkoutButton } from './CompleteWorkoutButton'
import type { CompletedExercise } from '@features/workouts/types/workouts'

interface ActiveWorkoutScreenProps {
    exercises: CompletedExercise[]
    currentExerciseIndex: number | null
    totalSetsCompleted: number
    totalDurationSeconds: number
    isCompleting?: boolean
    onExerciseSelect?: (index: number) => void
    onSetToggle?: (exerciseIndex: number, setIndex: number) => void
    onCompleteWorkout?: () => void
    className?: string
}

export function ActiveWorkoutScreen({
    exercises,
    currentExerciseIndex,
    totalSetsCompleted,
    totalDurationSeconds,
    isCompleting = false,
    onExerciseSelect,
    onSetToggle,
    onCompleteWorkout,
    className,
}: ActiveWorkoutScreenProps) {
    const currentExercise = currentExerciseIndex !== null ? exercises[currentExerciseIndex] : null

    const handleSetToggle = useCallback(
        (setIndex: number) => {
            if (currentExerciseIndex !== null && onSetToggle) {
                onSetToggle(currentExerciseIndex, setIndex)
            }
        },
        [currentExerciseIndex, onSetToggle],
    )

    return (
        <div className={cn('space-y-4 pb-24', className)}>
            {/* Список упражнений */}
            <section>
                <h2 className="mb-3 text-sm font-semibold text-telegram-text">Упражнения</h2>
                <div className="space-y-2">
                    {exercises.map((exercise, index) => (
                        <ExerciseCard
                            key={index}
                            exercise={exercise}
                            isActive={index === currentExerciseIndex}
                            onClick={() => onExerciseSelect?.(index)}
                        />
                    ))}
                </div>
            </section>

            {/* Текущее упражнение и подходы */}
            {currentExercise && currentExerciseIndex !== null && (
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-telegram-text">
                        {currentExercise.name} - Подходы
                    </h2>
                    <SetTable
                        sets={currentExercise.sets_completed || []}
                        onToggleSet={handleSetToggle}
                    />
                </section>
            )}

            {/* Таймер отдыха */}
            <RestTimer initialSeconds={90} />

            {/* Кнопка завершения */}
            <CompleteWorkoutButton
                totalSetsCompleted={totalSetsCompleted}
                totalDurationSeconds={totalDurationSeconds}
                isCompleting={isCompleting}
                onComplete={() => onCompleteWorkout?.()}
            />
        </div>
    )
}
