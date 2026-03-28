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
