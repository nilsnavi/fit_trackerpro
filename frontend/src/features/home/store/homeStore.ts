import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WaterData, WorkoutTemplate } from '@features/home/types/homeWidgets'

export type { GlucoseData, WellnessData, WaterData, WorkoutTemplate } from '@features/home/types/homeWidgets'

/** Локальные предпочтения и черновики главной (без серверной загрузки). */
export interface HomeUiState {
    userName: string
    avatarUrl?: string
    water: WaterData
    workoutTemplates: WorkoutTemplate[]
    setUserName: (name: string) => void
    setAvatarUrl: (url: string) => void
    setWater: (data: WaterData) => void
    addWater: (amount: number) => void
    setWorkoutTemplates: (templates: WorkoutTemplate[]) => void
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

export const useHomeStore = create<HomeUiState>()(
    persist(
        (set) => ({
            userName: '',
            avatarUrl: undefined,
            water: {
                current: 0,
                goal: 2500,
                unit: 'мл',
            },
            workoutTemplates: defaultWorkoutTemplates,
            setUserName: (name) => set({ userName: name }),
            setAvatarUrl: (url) => set({ avatarUrl: url }),
            setWater: (data) => set({ water: data }),
            addWater: (amount) =>
                set((state) => ({
                    water: {
                        ...state.water,
                        current: Math.min(state.water.current + amount, state.water.goal),
                    },
                })),
            setWorkoutTemplates: (templates) => set({ workoutTemplates: templates }),
        }),
        {
            name: 'home-storage',
            partialize: (state) => ({
                userName: state.userName,
                avatarUrl: state.avatarUrl,
                water: state.water,
                workoutTemplates: state.workoutTemplates,
            }),
        },
    ),
)
