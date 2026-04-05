import { useMemo, useState } from 'react'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import {
    useWorkoutModeEditorActions,
    useWorkoutModeEditorStateSlice,
} from '@features/workouts/model/useWorkoutModeEditorStore'
import type {
    UseWorkoutModePageStateParams,
    UseWorkoutModePageStateResult,
} from './useWorkoutModePageState.types'

export function useWorkoutModePageState({ config }: UseWorkoutModePageStateParams): UseWorkoutModePageStateResult {
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const [addSheetOpen, setAddSheetOpen] = useState(false)
    const [descOpen, setDescOpen] = useState(false)
    const [repeatError, setRepeatError] = useState<string | null>(null)
    const [saveAndStartError, setSaveAndStartError] = useState<string | null>(null)

    const {
        title: editorTitle,
        description: editorDescription,
        exercises: editorExercises,
        validationErrors,
        isDirty,
    } = useWorkoutModeEditorStateSlice()

    const {
        setMode: storeSetMode,
        setTitle,
        setDescription,
        addExercise,
        updateExercise,
        removeExercise,
        reorderExercises,
        validate,
        reset: resetEditor,
    } = useWorkoutModeEditorActions()

    const { data: historyData } = useWorkoutHistoryQuery()

    const recentWorkout = useMemo(() => {
        const items = historyData?.items ?? []
        const modePrefix = config.title.trim().toLowerCase()
        return (
            items.find((item) => {
                const comment = item.comments?.trim().toLowerCase() ?? ''
                return comment.startsWith(modePrefix)
            }) ?? null
        )
    }, [config.title, historyData])

    return {
        selectedPresetId,
        setSelectedPresetId,
        addSheetOpen,
        setAddSheetOpen,
        descOpen,
        setDescOpen,
        repeatError,
        setRepeatError,
        saveAndStartError,
        setSaveAndStartError,
        editorTitle,
        editorDescription,
        editorExercises,
        validationErrors,
        isDirty,
        storeSetMode,
        setTitle,
        setDescription,
        addExercise,
        updateExercise,
        removeExercise,
        reorderExercises,
        validate,
        resetEditor,
        recentWorkout,
    }
}
