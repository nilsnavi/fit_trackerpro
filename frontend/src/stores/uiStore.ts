import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Локальные UI-преференсы (персист). Экраны пока не импортируют этот стор —
 * при рефакторинге заменяйте разрозненный useState здесь; данные с API только через Query.
 */

export type AnalyticsRange = '7d' | '30d' | '90d' | '1y'

interface ExerciseCatalogState {
    search: string
    category: string
}

interface UiState {
    achievementsShowOnlyUnlocked: boolean
    setAchievementsShowOnlyUnlocked: (showOnlyUnlocked: boolean) => void

    analyticsRange: AnalyticsRange
    setAnalyticsRange: (range: AnalyticsRange) => void

    healthQuickWaterMl: number
    setHealthQuickWaterMl: (quickWaterMl: number) => void

    profileCoachModalOpen: boolean
    setProfileCoachModalOpen: (open: boolean) => void

    exerciseCatalog: ExerciseCatalogState
    setExerciseCatalogSearch: (search: string) => void
    setExerciseCatalogCategory: (category: string) => void
    resetExerciseCatalog: () => void
}

export const useUiStore = create<UiState>()(
    persist(
        (set) => ({
            achievementsShowOnlyUnlocked: false,
            setAchievementsShowOnlyUnlocked: (achievementsShowOnlyUnlocked) =>
                set({ achievementsShowOnlyUnlocked }),

            analyticsRange: '30d',
            setAnalyticsRange: (analyticsRange) => set({ analyticsRange }),

            healthQuickWaterMl: 250,
            setHealthQuickWaterMl: (healthQuickWaterMl) => set({ healthQuickWaterMl }),

            profileCoachModalOpen: false,
            setProfileCoachModalOpen: (profileCoachModalOpen) =>
                set({ profileCoachModalOpen }),

            exerciseCatalog: { search: '', category: 'all' },
            setExerciseCatalogSearch: (search) =>
                set((s) => ({
                    exerciseCatalog: { ...s.exerciseCatalog, search },
                })),
            setExerciseCatalogCategory: (category) =>
                set((s) => ({
                    exerciseCatalog: { ...s.exerciseCatalog, category },
                })),
            resetExerciseCatalog: () =>
                set({ exerciseCatalog: { search: '', category: 'all' } }),
        }),
        {
            name: 'ui-preferences',
            version: 1,
            partialize: (state) => ({
                achievementsShowOnlyUnlocked: state.achievementsShowOnlyUnlocked,
                analyticsRange: state.analyticsRange,
                healthQuickWaterMl: state.healthQuickWaterMl,
                exerciseCatalog: state.exerciseCatalog,
            }),
        },
    ),
)
