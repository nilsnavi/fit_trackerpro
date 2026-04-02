import type { CalendarDayData } from '../types/calendarPage'
import type { CalendarWorkout } from '../types/workouts'

export const isSameDay = (date1: Date, date2: Date): boolean =>
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()

export const getStartOfMonth = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), 1)

export const getEndOfMonth = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0)

export const getCalendarDays = (currentMonth: Date): CalendarDayData[] => {
    const startOfMonth = getStartOfMonth(currentMonth)
    const endOfMonth = getEndOfMonth(currentMonth)
    const startDay = startOfMonth.getDay() || 7 // 1 = Monday, 7 = Sunday
    const daysInMonth = endOfMonth.getDate()

    const days: CalendarDayData[] = []
    const today = new Date()

    // Previous month days
    const prevMonthDays = startDay - 1
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0)
    for (let i = prevMonthDays - 1; i >= 0; i--) {
        const date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate() - i)
        days.push({ date, workouts: [], isCurrentMonth: false, isToday: isSameDay(date, today) })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)
        days.push({ date, workouts: [], isCurrentMonth: true, isToday: isSameDay(date, today) })
    }

    // Next month days to fill 6 rows (42 cells)
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i)
        days.push({ date, workouts: [], isCurrentMonth: false, isToday: isSameDay(date, today) })
    }

    return days
}

export const formatCalendarDate = (date: Date): string =>
    date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

export const calculateStreak = (workoutList: CalendarWorkout[]): number => {
    const today = new Date()
    let streak = 0
    const checkDate = new Date(today)
    let shouldContinue = true

    while (shouldContinue) {
        const hasWorkout = workoutList.some(
            (w) => w.status === 'completed' && isSameDay(new Date(w.scheduled_at), checkDate),
        )
        if (hasWorkout) {
            streak++
            checkDate.setDate(checkDate.getDate() - 1)
        } else {
            shouldContinue = false
        }
    }

    return streak
}
