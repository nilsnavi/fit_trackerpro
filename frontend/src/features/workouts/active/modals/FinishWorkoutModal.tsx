import { FinishWorkoutSheet } from '@features/workouts/components'
import { formatDurationMinutes } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import type { ActiveWorkoutSyncState } from '@/state/local'

interface FinishWorkoutModalProps {
    isOpen: boolean
    durationMinutes: number
    completedExercises: CompletedExercise[]
    comment: string
    tagsDraft: string
    isPending: boolean
    errorMessage: string | null
    syncState?: ActiveWorkoutSyncState
    onClose: () => void
    onConfirm: () => void
    onChangeTagsDraft: (value: string) => void
}

export function FinishWorkoutModal({
    isOpen,
    durationMinutes,
    completedExercises,
    comment,
    tagsDraft,
    isPending,
    errorMessage,
    syncState,
    onClose,
    onConfirm,
    onChangeTagsDraft,
}: FinishWorkoutModalProps) {
    return (
        <FinishWorkoutSheet
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            durationLabel={formatDurationMinutes(durationMinutes)}
            completedExercises={completedExercises}
            comment={comment}
            tagsDraft={tagsDraft}
            onChangeTagsDraft={onChangeTagsDraft}
            isPending={isPending}
            errorMessage={errorMessage}
            syncState={syncState}
        />
    )
}
