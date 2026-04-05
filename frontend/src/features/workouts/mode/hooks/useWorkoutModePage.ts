import { useCallback } from 'react'
import { useUnsavedChangesGuard } from '@shared/hooks/useUnsavedChangesGuard'
import { useWorkoutModeActions } from './useWorkoutModeActions'
import { useWorkoutModeValidation } from './useWorkoutModeValidation'
import { useWorkoutModePageState } from './useWorkoutModePageState'
import { useWorkoutModePageEffects } from './useWorkoutModePageEffects'
import type { UseWorkoutModePageResult } from './useWorkoutModePage.types'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'

export function useWorkoutModePage(config: WorkoutTypeConfig): UseWorkoutModePageResult {
    const state = useWorkoutModePageState({ config })

    const { isConfirmOpen: isLeaveConfirmOpen, guardedAction, onLeave, onStay } = useUnsavedChangesGuard({
        isDirty: state.isDirty,
        onConfirmedLeave: state.resetEditor,
        enableRouteBlock: true,
    })

    useWorkoutModePageEffects({
        config,
        selectedPresetId: state.selectedPresetId,
        editorTitle: state.editorTitle,
        setMode: state.storeSetMode,
        setTitle: state.setTitle,
        reset: state.resetEditor,
        guardedAction,
    })

    const {
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
        mode,
    } = useWorkoutModeActions({
        config,
        selectedPresetId: state.selectedPresetId,
        setSelectedPresetId: state.setSelectedPresetId,
        setAddSheetOpen: state.setAddSheetOpen,
        setTitle: state.setTitle,
        updateExercise: state.updateExercise,
        addExercise: state.addExercise,
        validate: state.validate,
        editorTitle: state.editorTitle,
        editorExercises: state.editorExercises,
        recentWorkout: state.recentWorkout,
        onRepeatError: state.setRepeatError,
        onSaveAndStartError: state.setSaveAndStartError,
    })

    const {
        isEditorInvalid,
        handleSaveWithValidationUx,
        handleSaveAndStartWithValidationUx,
    } = useWorkoutModeValidation({
        editorTitle: state.editorTitle,
        editorExercises: state.editorExercises,
        validate: state.validate,
        onSave: handleSave,
        onSaveAndStart: handleSaveAndStart,
    })

    const toggleDesc = useCallback(() => {
        state.setDescOpen((prev) => !prev)
    }, [state.setDescOpen])

    return {
        editorTitle: state.editorTitle,
        editorDescription: state.editorDescription,
        editorExercises: state.editorExercises,
        validationErrors: state.validationErrors,
        selectedPresetId: state.selectedPresetId,
        addSheetOpen: state.addSheetOpen,
        descOpen: state.descOpen,
        repeatError: state.repeatError,
        saveAndStartError: state.saveAndStartError,
        isLeaveConfirmOpen,
        recentWorkoutTitle: state.recentWorkout?.comments ?? null,
        removeExercise: state.removeExercise,
        reorderExercises: state.reorderExercises,
        setTitle: state.setTitle,
        setDescription: state.setDescription,
        onLeave,
        onStay,
        toggleDesc,
        handleSelectPreset,
        handleOpenAddSheet,
        handleCloseAddSheet,
        handleUpdateExerciseParams,
        handleAddExercise,
        handleRepeat,
        handleSaveWithValidationUx,
        handleSaveAndStartWithValidationUx,
        isSaving,
        isStarting,
        isRepeating,
        isMutating,
        isEditorInvalid,
        mode,
    }
}
