import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WaterData, WorkoutTemplate } from '@features/home/types/homeWidgets'

export type { GlucoseData, WellnessData, WaterData, WorkoutTemplate } from '@features/home/types/homeWidgets'

export type AnalyticsRange = '7d' | '30d' | '90d' | '1y'

interface HomeState {
    userName: string
    avatarUrl?: string
    water: WaterData
    workoutTemplates: WorkoutTemplate[]
}

interface ExerciseCatalogState {
    search: string
    category: string
}

/** Эфемерное и локально сохраняемое UI-состояние приложения (без серверной загрузки). */
interface UiState {
    home: HomeState
    setHomeUserName: (name: string) => void
    setHomeAvatarUrl: (url: string | undefined) => void
    setHomeWater: (data: WaterData) => void
    addHomeWater: (amount: number) => void
    setHomeWorkoutTemplates: (templates: WorkoutTemplate[]) => void

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

const defaultWorkoutTemplates: WorkoutTemplate[] = [
    {
        id: 'strength-1',
        name: 'Силовая 1',
        type: 'strength',
        exerciseCount: 6,
        lastWorkout: '2 дня назад',
        color: 'from-blue-500 to-blue-600',
        icon: 'dumbbell',
    },
    {
        id: 'strength-2',
        name: 'Силовая 2',
        type: 'strength',
        exerciseCount: 5,
        lastWorkout: '5 дней назад',
        color: 'from-indigo-500 to-indigo-600',
        icon: 'dumbbell',
    },
    {
        id: 'functional',
        name: 'Функционал',
        type: 'functional',
        exerciseCount: 8,
        lastWorkout: '1 день назад',
        color: 'from-orange-500 to-orange-600',
        icon: 'zap',
    },
    {
        id: 'cardio',
        name: 'Кардио',
        type: 'cardio',
        exerciseCount: 3,
        lastWorkout: '3 дня назад',
        color: 'from-red-500 to-red-600',
        icon: 'heart',
    },
    {
        id: 'yoga',
        name: 'Йога',
        type: 'yoga',
        exerciseCount: 12,
        lastWorkout: '1 неделю назад',
        color: 'from-green-500 to-green-600',
        icon: 'activity',
    },
    {
        id: 'custom',
        name: 'Manual',
        type: 'custom',
        exerciseCount: 0,
        color: 'from-purple-500 to-purple-600',
        icon: 'plus',
    },
]

const defaultHome: HomeState = {
    userName: '',
    avatarUrl: undefined,
    water: {
        current: 0,
        goal: 2500,
        unit: 'мл',
    },
    workoutTemplates: defaultWorkoutTemplates,
}

export const useUiStore = create<UiState>()(
    persist(
        (set) => ({
            home: defaultHome,
            setHomeUserName: (userName) =>
                set((s) => ({ home: { ...s.home, userName } })),
            setHomeAvatarUrl: (avatarUrl) =>
                set((s) => ({ home: { ...s.home, avatarUrl } })),
            setHomeWater: (water) => set((s) => ({ home: { ...s.home, water } })),
            addHomeWater: (amount) =>
                set((s) => ({
                    home: {
                        ...s.home,
                        water: {
                            ...s.home.water,
                            current: Math.min(
                                s.home.water.current + amount,
                                s.home.water.goal,
                            ),
                        },
                    },
                })),
            setHomeWorkoutTemplates: (workoutTemplates) =>
                set((s) => ({ home: { ...s.home, workoutTemplates } })),

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
            /** Прежний ключ `home-storage` из homeStore — сохраняем данные виджетов. */
            name: 'home-storage',
            version: 1,
            migrate: (persisted) => {
                if (!persisted || typeof persisted !== 'object') return persisted
                const p = persisted as Record<string, unknown>
                const nested = p.home
                if (nested && typeof nested === 'object') return persisted
                if ('userName' in p || 'water' in p || 'workoutTemplates' in p) {
                    return {
                        home: {
                            userName: (p.userName as string) ?? '',
                            avatarUrl: p.avatarUrl as string | undefined,
                            water: (p.water as WaterData) ?? defaultHome.water,
                            workoutTemplates:
                                (p.workoutTemplates as WorkoutTemplate[]) ??
                                defaultHome.workoutTemplates,
                        },
                    }
                }
                return persisted
            },
            partialize: (state) => ({
                home: {
                    userName: state.home.userName,
                    avatarUrl: state.home.avatarUrl,
                    water: state.home.water,
                    workoutTemplates: state.home.workoutTemplates,
                },
            }),
        },
    ),
)
