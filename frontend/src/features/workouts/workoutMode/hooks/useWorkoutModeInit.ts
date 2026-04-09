/**
 * Initializes the workout mode editor store on mount and cleans up on unmount.
 * Also keeps the workout title in sync when the preset changes.
 */
import { useEffect } from 'react'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type { EditorWorkoutMode } from '../workoutModeEditorTypes'

interface UseWorkoutModeInitParams {
    config: WorkoutTypeConfig | null
    selectedPresetId: string | null
    editorTitle: string
    setMode: (mode: EditorWorkoutMode) => void
    setTitle: (title: string) => void
    reset: () => void
}

export function useWorkoutModeInit({
    config,
    selectedPresetId,
    editorTitle,
    setMode,
    setTitle,
    reset,
}: UseWorkoutModeInitParams): void {
    // Initialise store mode and preset on config change
    useEffect(() => {
        if (config) {
            setMode(config.mode as EditorWorkoutMode)
        }
        if (config?.presets.length) {
            // setSelectedPresetId is handled in the page component; initial
            // title is applied by the preset-sync effect below.
        }
        return () => {
            reset()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config?.mode])

    // Keep title in sync when preset changes
    useEffect(() => {
        if (!config) return
        const preset = config.presets.find((p) => p.id === selectedPresetId) ?? config.presets[0]
        if (!editorTitle || editorTitle === '') {
            setTitle(preset ? `${config.title} • ${preset.label}` : config.title)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPresetId, config?.mode])
}
