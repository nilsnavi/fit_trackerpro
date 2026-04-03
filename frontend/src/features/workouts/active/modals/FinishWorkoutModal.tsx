import { FinishWorkoutSheet } from '@features/workouts/components'
import { formatDurationMinutes } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise } from '@features/workouts/types/workouts'

interface FinishWorkoutModalProps {
    isOpen: boolean
    durationMinutes: number
    completedExercises: CompletedExercise[]
    comment: string
    tagsDraft: string
    isPending: boolean
    errorMessage: string | null
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
        />
    )
}
