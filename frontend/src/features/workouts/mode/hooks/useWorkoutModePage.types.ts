import type {
    EditorWorkoutMode,
    ModeExerciseParams,
    WorkoutModeEditorValidationErrors,
    WorkoutModeExerciseItem,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'

export interface UseWorkoutModePageResult {
    editorTitle: string
    editorDescription: string
    editorExercises: WorkoutModeExerciseItem[]
    validationErrors: WorkoutModeEditorValidationErrors
    selectedPresetId: string | null
    addSheetOpen: boolean
    descOpen: boolean
    repeatError: string | null
    saveAndStartError: string | null
    isLeaveConfirmOpen: boolean
    recentWorkoutTitle: string | null
    removeExercise: (id: string) => void
    reorderExercises: (fromIndex: number, toIndex: number) => void
    setTitle: (title: string) => void
    setDescription: (description: string) => void
    onLeave: () => void
    onStay: () => void
    toggleDesc: () => void
    handleSelectPreset: (presetId: string) => void
    handleOpenAddSheet: () => void
    handleCloseAddSheet: () => void
    handleUpdateExerciseParams: (id: string, params: ModeExerciseParams) => void
    handleAddExercise: (
        exerciseId: number,
        name: string,
        category: string | undefined,
        params: ModeExerciseParams,
    ) => void
    handleRepeat: () => Promise<void>
    handleSaveWithValidationUx: () => void
    handleSaveAndStartWithValidationUx: () => Promise<void>
    isSaving: boolean
    isStarting: boolean
    isRepeating: boolean
    isMutating: boolean
    isEditorInvalid: boolean
    mode: EditorWorkoutMode
}
