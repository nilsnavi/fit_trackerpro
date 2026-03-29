/**
 * DTO виджетов главного экрана (дашборд).
 * Сущности API — в @features/health/types/metrics и workouts; здесь только представление для UI.
 */

export type GlucoseWidgetStatus = 'normal' | 'high' | 'low' | 'critical'

export interface GlucoseData {
    value: number
    /** Подпись единицы для UI (см. mapHealthToDashboard: из GlucoseUnit API). */
    unit: string
    status: GlucoseWidgetStatus
    recorded_at: string
}

export type WellnessWidgetMood = 'great' | 'good' | 'okay' | 'bad' | 'terrible'

export interface WellnessData {
    score: number
    mood: WellnessWidgetMood
    note?: string
    recorded_at: string
}

export interface WaterData {
    current: number
    goal: number
    unit: string
}

/** Карточка программы на главной (mock/UI), не путать с WorkoutTemplateCreateRequest API. */
export type HomeWorkoutCardType = 'strength' | 'cardio' | 'yoga' | 'functional' | 'custom'

export interface HomeWorkoutTemplate {
    id: string
    name: string
    type: HomeWorkoutCardType
    exerciseCount: number
    lastWorkout?: string
    color: string
    icon: string
}
