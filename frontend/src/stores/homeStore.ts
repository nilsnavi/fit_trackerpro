import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface GlucoseData {
    value: number
    unit: string
    status: 'normal' | 'high' | 'low' | 'critical'
    recorded_at: string
}

export interface WellnessData {
    score: number
    mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible'
    note?: string
    recorded_at: string
}

export interface WaterData {
    current: number
    goal: number
    unit: string
}

export interface WorkoutTemplate {
    id: string
    name: string
    type: 'strength' | 'cardio' | 'yoga' | 'functional' | 'custom'
    exerciseCount: number
    lastWorkout?: string
    color: string
    icon: string
}

export interface HomeState {
    // User data
    userName: string
    avatarUrl?: string

    // Health widgets
    glucose: GlucoseData | null
    wellness: WellnessData | null
    water: WaterData

    // Workouts
    workoutTemplates: WorkoutTemplate[]

    // Loading states
    isLoading: boolean
    isRefreshing: boolean
    lastUpdated: Date | null

    // Actions
    setUserName: (name: string) => void
    setAvatarUrl: (url: string) => void
    setGlucose: (data: GlucoseData | null) => void
    setWellness: (data: WellnessData | null) => void
    setWater: (data: WaterData) => void
    addWater: (amount: number) => void
    setWorkoutTemplates: (templates: WorkoutTemplate[]) => void
    setLoading: (loading: boolean) => void
    setRefreshing: (refreshing: boolean) => void
    refreshData: () => Promise<void>
    setLastUpdated: (date: Date) => void
}

const defaultWorkoutTemplates: WorkoutTemplate[] = [
    {
        id: 'strength-1',
        name: 'Силовая 1',
        type: 'strength',
        exerciseCount: 6,
        lastWorkout: '2 дня назад',
        color: 'from-blue-500 to-blue-600',
        icon: 'dumbbell'
    },
    {
        id: 'strength-2',
        name: 'Силовая 2',
        type: 'strength',
        exerciseCount: 5,
        lastWorkout: '5 дней назад',
        color: 'from-indigo-500 to-indigo-600',
        icon: 'dumbbell'
    },
    {
        id: 'functional',
        name: 'Функционал',
        type: 'functional',
        exerciseCount: 8,
        lastWorkout: '1 день назад',
        color: 'from-orange-500 to-orange-600',
        icon: 'zap'
    },
    {
        id: 'cardio',
        name: 'Кардио',
        type: 'cardio',
        exerciseCount: 3,
        lastWorkout: '3 дня назад',
        color: 'from-red-500 to-red-600',
        icon: 'heart'
    },
    {
        id: 'yoga',
        name: 'Йога',
        type: 'yoga',
        exerciseCount: 12,
        lastWorkout: '1 неделю назад',
        color: 'from-green-500 to-green-600',
        icon: 'activity'
    },
    {
        id: 'custom',
        name: 'Manual',
        type: 'custom',
        exerciseCount: 0,
        color: 'from-purple-500 to-purple-600',
        icon: 'plus'
    }
]

const mockFetchData = async (): Promise<Partial<HomeState>> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
        glucose: {
            value: 5.4,
            unit: 'ммоль/л',
            status: 'normal',
            recorded_at: new Date().toISOString()
        },
        wellness: {
            score: 8,
            mood: 'good',
            recorded_at: new Date().toISOString()
        },
        water: {
            current: 1200,
            goal: 2500,
            unit: 'мл'
        },
        workoutTemplates: defaultWorkoutTemplates
    }
}

export const useHomeStore = create<HomeState>()(
    persist(
        (set) => ({
            userName: '',
            avatarUrl: undefined,
            glucose: null,
            wellness: null,
            water: {
                current: 0,
                goal: 2500,
                unit: 'мл'
            },
            workoutTemplates: defaultWorkoutTemplates,
            isLoading: false,
            isRefreshing: false,
            lastUpdated: null,

            setUserName: (name) => set({ userName: name }),
            setAvatarUrl: (url) => set({ avatarUrl: url }),
            setGlucose: (data) => set({ glucose: data }),
            setWellness: (data) => set({ wellness: data }),
            setWater: (data) => set({ water: data }),
            addWater: (amount) => set((state) => ({
                water: {
                    ...state.water,
                    current: Math.min(state.water.current + amount, state.water.goal)
                }
            })),
            setWorkoutTemplates: (templates) => set({ workoutTemplates: templates }),
            setLoading: (loading) => set({ isLoading: loading }),
            setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
            setLastUpdated: (date) => set({ lastUpdated: date }),

            refreshData: async () => {
                set({ isRefreshing: true })
                try {
                    const data = await mockFetchData()
                    set({
                        ...data,
                        lastUpdated: new Date()
                    })
                } catch (error) {
                    console.error('Failed to refresh data:', error)
                } finally {
                    set({ isRefreshing: false })
                }
            }
        }),
        {
            name: 'home-storage',
            partialize: (state) => ({
                userName: state.userName,
                avatarUrl: state.avatarUrl,
                water: state.water,
                workoutTemplates: state.workoutTemplates
            })
        }
    )
)
