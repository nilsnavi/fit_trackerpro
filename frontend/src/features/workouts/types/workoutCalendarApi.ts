export interface CalendarDayEntryApi {
    date: string
    has_workout: boolean
    workout_count: number
    total_duration: number
    workout_types: string[]
    glucose_logged: boolean
    wellness_logged: boolean
}

export interface WorkoutCalendarSummaryApi {
    total_workouts: number
    total_duration: number
    active_days: number
    rest_days: number
}

export interface WorkoutCalendarResponseApi {
    year: number
    month: number
    days: CalendarDayEntryApi[]
    summary: WorkoutCalendarSummaryApi
}

