/** Типы ответов health-metrics API (общие для API и UI). */

export interface WaterEntry {
    id: number
    user_id: number
    amount: number
    recorded_at: string
    created_at: string
}

export interface WaterGoal {
    id: number
    user_id: number
    daily_goal: number
    workout_increase: number
    is_workout_day: boolean
    created_at: string
    updated_at: string
}

export interface WaterReminder {
    id: number
    user_id: number
    enabled: boolean
    interval_hours: number
    start_time: string
    end_time: string
    quiet_hours_start: string
    quiet_hours_end: string
    telegram_notifications: boolean
    created_at: string
    updated_at: string
}

export interface WaterDailyStats {
    date: string
    total: number
    goal: number
    percentage: number
    is_goal_reached: boolean
    entry_count: number
}

export interface WaterWeeklyStats {
    days: WaterDailyStats[]
    average: number
    best_day: WaterDailyStats | null
    total_entries: number
}

export type GlucoseUnit = 'mmol' | 'mgdl'
export type GlucoseMeasurementType = 'before' | 'after' | 'random'

export interface GlucoseReading {
    id: number
    user_id: number
    value: number
    unit: GlucoseUnit
    measurement_type: GlucoseMeasurementType
    recorded_at: string
    workout_id?: number | null
    notes?: string
    created_at: string
}

export interface GlucoseStats {
    average: number
    min: number
    max: number
    count: number
    unit: GlucoseUnit
}

export interface PainZones {
    head: number
    neck: number
    shoulders: number
    chest: number
    back: number
    arms: number
    wrists: number
    hips: number
    knees: number
    ankles: number
}

export interface WellnessEntry {
    id: number
    user_id: number
    date: string
    sleep_score: number
    sleep_hours?: number
    energy_score: number
    pain_zones: PainZones
    stress_level?: number
    mood_score?: number
    notes?: string
    created_at: string
    updated_at: string
}

export interface WellnessStats {
    avg_sleep_score_7d?: number
    avg_sleep_score_30d?: number
    avg_energy_score_7d?: number
    avg_energy_score_30d?: number
    avg_sleep_hours_7d?: number
    avg_sleep_hours_30d?: number
}
