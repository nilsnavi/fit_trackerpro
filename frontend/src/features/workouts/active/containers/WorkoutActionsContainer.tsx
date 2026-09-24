import { memo } from 'react'
import { ActiveWorkoutBottomActions } from '@features/workouts/active/containers/ActiveWorkoutBottomActions'
import type { CompletedExercise } from '@features/workouts/types/workouts'

export interface WorkoutActionsContainerProps {
    isActiveDraft: boolean
    restPresets: number[]
    restDefaultSeconds: number
    currentExercise: CompletedExercise | null
    isFinishing: boolean
    onSelectRestPreset: (seconds: number) => void
    onAddItem: (kind: 'exercise' | 'timer') => void
    onRemoveSet: () => void
    onAddSet: () => void
    onFinishWorkout: () => void
    hideFinishButton?: boolean
}

/**
 * WorkoutActionsContainer
 * 
 * Контейнер для действий тренировки (добавление подходов, завершение и т.д.)
 * Инкапсулирует навигацию и бизнес-логику действий.
 */
export const WorkoutActionsContainer = memo(function WorkoutActionsContainer({
    isActiveDraft,
    restPresets,
    restDefaultSeconds,
    currentExercise,
    isFinishing,
    onSelectRestPreset,
    onAddItem,
    onRemoveSet,
    onAddSet,
    onFinishWorkout,
    hideFinishButton,
}: WorkoutActionsContainerProps) {
    return (
        <ActiveWorkoutBottomActions
            isActiveDraft={isActiveDraft}
            restPresets={restPresets}
            restDefaultSeconds={restDefaultSeconds}
            currentExercise={currentExercise}
            isFinishing={isFinishing}
            onSelectRestPreset={onSelectRestPreset}
            onAddItem={onAddItem}
            onRemoveSet={onRemoveSet}
            onAddSet={onAddSet}
            onFinishWorkout={onFinishWorkout}
            hideFinishButton={hideFinishButton}
        />
    )
})
