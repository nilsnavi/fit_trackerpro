import { memo } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { EmptyWorkoutState } from '@features/workouts/active/components/EmptyWorkoutState'
import { ActiveExerciseList } from '@features/workouts/active/components/ActiveExerciseList'
import type { WorkoutHistoryItem, WeightRecommendationResponse } from '@features/workouts/types/workouts'

export interface ActiveExerciseContainerProps {
    workout: WorkoutHistoryItem
    currentExerciseIndex: number
    currentSetIndex: number
    previousBestLabelsByExercise: Map<string, string>
    canReorder: boolean
    weightRecommendation?: WeightRecommendationResponse
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    onDragEnd: (result: any) => void
    onOpenStructureEditor: () => void
    onAddSet: (exerciseIndex: number) => void
    onRemoveSet: (exerciseIndex: number) => void
    onDeleteExercise: (exerciseIndex: number) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onToggleSetCompleted: (exerciseIndex: number, setNumber: number, completed: boolean) => void
    onSkipSet: (exerciseIndex: number) => void
    onCopyPreviousSet: (exerciseIndex: number) => void
    onAdjustWeight: (exerciseIndex: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: any) => void
    onNotesChange: (exerciseIndex: number, notes: string | undefined) => void
    onAddExercise: () => void
}

/**
 * ActiveExerciseContainer
 * 
 * Контейнер для списка упражнений активной тренировки.
 * Обрабатывает empty state и делегирует логику дочерним компонентам.
 */
export const ActiveExerciseContainer = memo(function ActiveExerciseContainer({
    workout,
    currentExerciseIndex,
    currentSetIndex,
    previousBestLabelsByExercise,
    canReorder,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    onDragEnd,
    onOpenStructureEditor,
    onAddSet,
    onRemoveSet,
    onDeleteExercise,
    onSetCurrentPosition,
    onToggleSetCompleted,
    onSkipSet,
    onCopyPreviousSet,
    onAdjustWeight,
    onUpdateSet,
    onNotesChange,
    onAddExercise,
}: ActiveExerciseContainerProps) {
    const tg = useTelegramWebApp()

    // Empty state для пустой тренировки
    if (workout.exercises.length === 0) {
        return <EmptyWorkoutState onAddExercise={onAddExercise} />
    }

    // Список упражнений с haptic feedback
    return (
        <ActiveExerciseList
            exercises={workout.exercises}
            currentExerciseIndex={currentExerciseIndex}
            currentSetIndex={currentSetIndex}
            previousBestLabelsByExercise={previousBestLabelsByExercise}
            canReorder={canReorder}
            weightRecommendation={weightRecommendation}
            isWeightRecLoading={isWeightRecLoading}
            isWeightRecError={isWeightRecError}
            onDragEnd={(result) => {
                tg.hapticFeedback({ type: 'selection' })
                onDragEnd(result)
            }}
            onOpenStructureEditor={onOpenStructureEditor}
            onAddSet={() => onAddSet(currentExerciseIndex)}
            onRemoveSet={() => onRemoveSet(currentExerciseIndex)}
            onDeleteExercise={(exerciseIndex) => {
                tg.hapticFeedback({ type: 'impact', style: 'heavy' })
                onDeleteExercise(exerciseIndex)
            }}
            onSetCurrentPosition={onSetCurrentPosition}
            onToggleSetCompleted={(exerciseIndex, setNumber, completed) => {
                tg.hapticFeedback({ type: 'selection' })
                onToggleSetCompleted(exerciseIndex, setNumber, completed)
            }}
            onSkipSet={() => onSkipSet(currentExerciseIndex)}
            onCopyPreviousSet={(exerciseIndex) => {
                tg.hapticFeedback({ type: 'impact', style: 'light' })
                onCopyPreviousSet(exerciseIndex)
            }}
            onAdjustWeight={onAdjustWeight}
            onUpdateSet={onUpdateSet}
            onNotesChange={onNotesChange}
        />
    )
})
