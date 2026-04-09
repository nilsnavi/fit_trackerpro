import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import type {
    EditorWorkoutMode,
    ModeExerciseParams,
    WorkoutModeExerciseItem,
} from '../workoutModeEditorTypes'

export interface UseWorkoutModeActionsParams {
    config: WorkoutTypeConfig
    selectedPresetId: string | null
    setSelectedPresetId: (id: string) => void
    setAddSheetOpen: (open: boolean) => void
    setTitle: (title: string) => void
    updateExercise: (id: string, patch: Partial<WorkoutModeExerciseItem>) => void
    addExercise: (exercise: WorkoutModeExerciseItem) => void
    validate: () => boolean
    editorTitle: string
    editorExercises: WorkoutModeExerciseItem[]
    recentWorkout: WorkoutHistoryItem | null
    onRepeatError: (msg: string | null) => void
    onSaveAndStartError: (msg: string | null) => void
}

export interface UseWorkoutModeActionsResult {
    selectedPresetId: string | null
    handleRepeat: () => Promise<void>
    handleAddExercise: (
        exerciseId: number,
        name: string,
        category: string | undefined,
        params: ModeExerciseParams,
    ) => void
    handleSave: () => void
    handleSaveAndStart: () => Promise<void>
    handleOpenAddSheet: () => void
    handleCloseAddSheet: () => void
    handleUpdateExerciseParams: (id: string, params: ModeExerciseParams) => void
    handleSelectPreset: (presetId: string) => void
    isMutating: boolean
    isSaving: boolean
    isStarting: boolean
    isRepeating: boolean
    mode: EditorWorkoutMode
}
