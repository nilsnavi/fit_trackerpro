import type { DragEndEvent } from '@dnd-kit/core'
import { ActiveExerciseList } from '@features/workouts/active/components/ActiveExerciseList'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import type { ActiveWorkoutSyncState } from '@/state/local'

export interface ActiveWorkoutExerciseSectionProps {
    incrementScopePrefix: string
    exercises: CompletedExercise[]
    currentExerciseIndex: number
    currentSetIndex: number
    previousBestLabelsByExercise: Map<string, string>
    canReorder: boolean
    weightRecommendation: { suggested_weight?: number; message?: string } | undefined
    isWeightRecLoading: boolean
    isWeightRecError: boolean
    onDragEnd: (event: DragEndEvent) => void
    onAddSet: () => void
    onRemoveSet: () => void
    onDeleteExercise: (exerciseIndex: number) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onToggleSetCompleted: (exerciseIndex: number, setNumber: number, nextCompleted: boolean) => void
    onSkipSet: () => void
    onCopyPreviousSet: (exerciseIndex: number, setNumber: number) => void
    onAdjustWeight: (exerciseIndex: number, setNumber: number, delta: number) => void
    onUpdateSet: (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void
    onNotesChange: (exerciseIndex: number, notes: string | undefined) => void
    syncState: ActiveWorkoutSyncState
}

export function ActiveWorkoutExerciseSection({
    incrementScopePrefix,
    exercises,
    currentExerciseIndex,
    currentSetIndex,
    previousBestLabelsByExercise,
    canReorder,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    onDragEnd,
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
}: ActiveWorkoutExerciseSectionProps) {
    return (
        <ActiveExerciseList
            incrementScopePrefix={incrementScopePrefix}
            exercises={exercises}
            currentExerciseIndex={currentExerciseIndex}
            currentSetIndex={currentSetIndex}
            previousBestLabelsByExercise={previousBestLabelsByExercise}
            canReorder={canReorder}
            onDragEnd={onDragEnd}
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            onDeleteExercise={onDeleteExercise}
            onSetCurrentPosition={onSetCurrentPosition}
            onToggleSetCompleted={onToggleSetCompleted}
            onSkipSet={onSkipSet}
            onCopyPreviousSet={onCopyPreviousSet}
            onAdjustWeight={onAdjustWeight}
            onUpdateSet={onUpdateSet}
            onNotesChange={onNotesChange}
            weightRecommendation={weightRecommendation}
            isWeightRecLoading={isWeightRecLoading}
            isWeightRecError={isWeightRecError}
        />
    )
}

