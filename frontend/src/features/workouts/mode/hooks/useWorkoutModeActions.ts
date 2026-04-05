import { useCallback } from 'react'
import { useWorkoutModeHandlers } from './useWorkoutModeHandlers'
import type {
    EditorWorkoutMode,
    ModeExerciseParams,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'
import type {
    UseWorkoutModeActionsParams,
    UseWorkoutModeActionsResult,
} from './useWorkoutModeActions.types'

export function useWorkoutModeActions({
    config,
    selectedPresetId,
    setSelectedPresetId,
    setAddSheetOpen,
    setTitle,
    updateExercise,
    addExercise,
    validate,
    editorTitle,
    editorExercises,
    recentWorkout,
    onRepeatError,
    onSaveAndStartError,
}: UseWorkoutModeActionsParams): UseWorkoutModeActionsResult {
    const {
        handleRepeat,
        handleAddExercise,
        handleSave,
        handleSaveAndStart,
        isMutating,
        isSaving,
        isStarting,
        isRepeating,
    } = useWorkoutModeHandlers({
        config,
        selectedPresetId,
        editorTitle,
        editorExercises,
        recentWorkout,
        validate,
        addExercise,
        onAddSheetClose: () => setAddSheetOpen(false),
        onRepeatError,
        onSaveAndStartError,
    })

    const handleOpenAddSheet = useCallback(() => {
        setAddSheetOpen(true)
    }, [setAddSheetOpen])

    const handleCloseAddSheet = useCallback(() => {
        setAddSheetOpen(false)
    }, [setAddSheetOpen])

    const handleUpdateExerciseParams = useCallback((id: string, params: ModeExerciseParams) => {
        updateExercise(id, { params })
    }, [updateExercise])

    const handleSelectPreset = useCallback((id: string) => {
        setSelectedPresetId(id)
        const preset = config.presets.find((p) => p.id === id)
        if (preset) {
            setTitle(`${config.title} • ${preset.label}`)
        }
    }, [config.presets, config.title, setSelectedPresetId, setTitle])

    return {
        selectedPresetId,
        handleRepeat,
        handleAddExercise,
        handleSave,
        handleSaveAndStart,
        handleOpenAddSheet,
        handleCloseAddSheet,
        handleUpdateExerciseParams,
        handleSelectPreset,
        isMutating,
        isSaving,
        isStarting,
        isRepeating,
        mode: config.mode as EditorWorkoutMode,
    }
}
