import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_PRESETS = [45, 60, 90, 120, 180]

interface WorkoutRestPresetsState {
    presetsByScope: Record<string, number[]>
    defaultRestByScope: Record<string, number>
    getPresetsForScope: (scopeKey: string) => number[]
    getDefaultRestForScope: (scopeKey: string) => number
    setPresetsForScope: (scopeKey: string, presets: number[]) => void
    setDefaultRestForScope: (scopeKey: string, seconds: number) => void
}

function normalizePresets(presets: number[]): number[] {
    const unique = Array.from(
        new Set(
            presets
                .map((value) => Math.floor(value))
                .filter((value) => Number.isFinite(value) && value >= 15 && value <= 600),
        ),
    )
    const sorted = unique.sort((a, b) => a - b).slice(0, 8)
    return sorted.length > 0 ? sorted : DEFAULT_PRESETS
}

export const useWorkoutRestPresetsStore = create<WorkoutRestPresetsState>()(
    persist(
        (set, get) => ({
            presetsByScope: {},
            defaultRestByScope: {},
            getPresetsForScope: (scopeKey) => get().presetsByScope[scopeKey] ?? DEFAULT_PRESETS,
            getDefaultRestForScope: (scopeKey) => {
                const explicit = get().defaultRestByScope[scopeKey]
                if (explicit != null) return explicit
                const presets = get().presetsByScope[scopeKey] ?? DEFAULT_PRESETS
                return presets.includes(90) ? 90 : presets[0]
            },
            setPresetsForScope: (scopeKey, presets) =>
                set((state) => {
                    const normalized = normalizePresets(presets)
                    const currentDefault = state.defaultRestByScope[scopeKey]
                    const nextDefault =
                        currentDefault != null && normalized.includes(currentDefault)
                            ? currentDefault
                            : normalized[0]

                    return {
                        presetsByScope: {
                            ...state.presetsByScope,
                            [scopeKey]: normalized,
                        },
                        defaultRestByScope: {
                            ...state.defaultRestByScope,
                            [scopeKey]: nextDefault,
                        },
                    }
                }),
            setDefaultRestForScope: (scopeKey, seconds) =>
                set((state) => {
                    const normalized = Math.max(15, Math.min(600, Math.floor(seconds)))
                    const currentPresets = state.presetsByScope[scopeKey] ?? DEFAULT_PRESETS
                    const nextPresets = currentPresets.includes(normalized)
                        ? currentPresets
                        : normalizePresets([...currentPresets, normalized])

                    return {
                        presetsByScope: {
                            ...state.presetsByScope,
                            [scopeKey]: nextPresets,
                        },
                        defaultRestByScope: {
                            ...state.defaultRestByScope,
                            [scopeKey]: normalized,
                        },
                    }
                }),
        }),
        { name: 'workout-rest-presets' },
    ),
)
