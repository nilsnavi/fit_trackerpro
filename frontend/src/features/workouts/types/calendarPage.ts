import type { CalendarWorkout } from './workouts'

/** День сетки календаря тренировок (страница Calendar). */
export interface CalendarDayData {
    date: Date
    workouts: CalendarWorkout[]
    isCurrentMonth: boolean
    isToday: boolean
}

export interface CalendarMonthStats {
    totalWorkouts: number
    completedWorkouts: number
    currentStreak: number
    volumeChange: number
    totalDuration: number
}
