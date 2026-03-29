import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutMode } from '@features/workouts/config/workoutTypeConfigs'

interface WorkoutDraftState {
    selectedMode: WorkoutMode | null
    selectedPresetId: string | null
    setSelectedMode: (mode: WorkoutMode | null) => void
    setSelectedPresetId: (presetId: string | null) => void
    reset: () => void
}

export const useWorkoutDraftStore = create<WorkoutDraftState>()(
    persist(
        (set) => ({
            selectedMode: null,
            selectedPresetId: null,
            setSelectedMode: (selectedMode) => set({ selectedMode }),
            setSelectedPresetId: (selectedPresetId) => set({ selectedPresetId }),
            reset: () => set({ selectedMode: null, selectedPresetId: null }),
        }),
        { name: 'workout-draft-store' },
    ),
)
