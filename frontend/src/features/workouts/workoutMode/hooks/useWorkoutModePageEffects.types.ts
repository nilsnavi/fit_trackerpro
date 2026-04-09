import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type { EditorWorkoutMode } from '../workoutModeEditorTypes'

export interface UseWorkoutModePageEffectsParams {
    config: WorkoutTypeConfig
    selectedPresetId: string | null
    editorTitle: string
    setMode: (mode: EditorWorkoutMode) => void
    setTitle: (title: string) => void
    reset: () => void
    guardedAction: (action: () => void) => void
}
