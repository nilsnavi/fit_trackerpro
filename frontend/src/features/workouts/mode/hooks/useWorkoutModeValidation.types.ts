import type { WorkoutModeExerciseItem } from '@features/workouts/workoutMode/workoutModeEditorTypes'

export interface UseWorkoutModeValidationParams {
    editorTitle: string
    editorExercises: WorkoutModeExerciseItem[]
    validate: () => boolean
    onSave: () => void
    onSaveAndStart: () => Promise<void>
}

export interface UseWorkoutModeValidationResult {
    isEditorInvalid: boolean
    handleSaveWithValidationUx: () => void
    handleSaveAndStartWithValidationUx: () => Promise<void>
}
