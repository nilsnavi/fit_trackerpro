import type { Dispatch, SetStateAction } from 'react'
import type { EditorWorkoutMode, WorkoutModeEditorValidationErrors, WorkoutModeExerciseItem } from '@features/workouts/workoutMode/workoutModeEditorTypes'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

export interface UseWorkoutModePageStateParams {
    config: WorkoutTypeConfig
}

export interface UseWorkoutModePageStateResult {
    selectedPresetId: string | null
    setSelectedPresetId: Dispatch<SetStateAction<string | null>>
    addSheetOpen: boolean
    setAddSheetOpen: Dispatch<SetStateAction<boolean>>
    descOpen: boolean
    setDescOpen: Dispatch<SetStateAction<boolean>>
    repeatError: string | null
    setRepeatError: Dispatch<SetStateAction<string | null>>
    saveAndStartError: string | null
    setSaveAndStartError: Dispatch<SetStateAction<string | null>>
    editorTitle: string
    editorDescription: string
    editorExercises: WorkoutModeExerciseItem[]
    validationErrors: WorkoutModeEditorValidationErrors
    isDirty: boolean
    storeSetMode: (mode: EditorWorkoutMode) => void
    setTitle: (title: string) => void
    setDescription: (description: string) => void
    addExercise: (exercise: WorkoutModeExerciseItem) => void
    updateExercise: (id: string, patch: Partial<WorkoutModeExerciseItem>) => void
    removeExercise: (id: string) => void
    reorderExercises: (fromIndex: number, toIndex: number) => void
    validate: () => boolean
    resetEditor: () => void
    recentWorkout: WorkoutHistoryItem | null
}
