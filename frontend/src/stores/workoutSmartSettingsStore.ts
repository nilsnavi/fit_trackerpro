import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type HapticIntensity = 'light' | 'medium' | 'heavy'

export interface WorkoutSmartSettings {
    /** Ghost Mode — показывает предыдущие показатели упражнения */
    ghostMode: boolean
    /** Smart Rest — автоматический расчёт времени отдыха по RPE */
    smartRest: boolean
    /** Auto Start Rest — автостарт таймера после завершения подхода */
    autoStartRest: boolean
    /** One-Tap Logging — упрощённое завершение подхода */
    oneTapLogging: boolean
    /** Интенсивность haptic feedback */
    hapticIntensity: HapticIntensity
    /** Показывать подсказки для новых фич */
    showFeatureHints: boolean
}

interface WorkoutSmartSettingsState extends WorkoutSmartSettings {
    toggleGhostMode: () => void
    toggleSmartRest: () => void
    toggleAutoStartRest: () => void
    toggleOneTapLogging: () => void
    setHapticIntensity: (intensity: HapticIntensity) => void
    dismissFeatureHints: () => void
    resetToDefaults: () => void
}

const defaultSettings: WorkoutSmartSettings = {
    ghostMode: true,
    smartRest: true,
    autoStartRest: true,
    oneTapLogging: true,
    hapticIntensity: 'medium',
    showFeatureHints: true,
}

export const useWorkoutSmartSettingsStore = create<WorkoutSmartSettingsState>()(
    persist(
        (set) => ({
            ...defaultSettings,

            toggleGhostMode: () =>
                set((state) => ({ ghostMode: !state.ghostMode })),

            toggleSmartRest: () =>
                set((state) => ({ smartRest: !state.smartRest })),

            toggleAutoStartRest: () =>
                set((state) => ({ autoStartRest: !state.autoStartRest })),

            toggleOneTapLogging: () =>
                set((state) => ({ oneTapLogging: !state.oneTapLogging })),

            setHapticIntensity: (intensity) =>
                set({ hapticIntensity: intensity }),

            dismissFeatureHints: () =>
                set({ showFeatureHints: false }),

            resetToDefaults: () => set(defaultSettings),
        }),
        {
            name: 'workout-smart-settings-store',
            version: 1,
        },
    ),
)

// Selector hooks for optimal re-render performance
export function useGhostMode() {
    return useWorkoutSmartSettingsStore((s) => s.ghostMode)
}

export function useSmartRest() {
    return useWorkoutSmartSettingsStore((s) => s.smartRest)
}

export function useAutoStartRest() {
    return useWorkoutSmartSettingsStore((s) => s.autoStartRest)
}

export function useOneTapLogging() {
    return useWorkoutSmartSettingsStore((s) => s.oneTapLogging)
}

export function useHapticIntensity() {
    return useWorkoutSmartSettingsStore((s) => s.hapticIntensity)
}

export function useShowFeatureHints() {
    return useWorkoutSmartSettingsStore((s) => s.showFeatureHints)
}
