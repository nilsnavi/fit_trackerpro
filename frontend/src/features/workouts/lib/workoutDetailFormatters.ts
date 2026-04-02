import { Dumbbell, HeartPulse, Timer } from 'lucide-react'
import type { CompletedExercise } from '../types/workouts'

export const formatDate = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

export const formatDurationMinutes = (duration?: number): string => {
    if (typeof duration !== 'number' || duration <= 0) {
        return '—'
    }
    return `${duration} мин`
}

export const formatSetValue = (value?: number, unit?: string): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—'
    }
    return unit ? `${value} ${unit}` : `${value}`
}

export const parseOptionalNumber = (raw: string): number | undefined => {
    if (raw.trim() === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
}

export const pluralizeRu = (value: number, forms: [string, string, string]): string => {
    const absValue = Math.abs(value)
    const mod10 = absValue % 10
    const mod100 = absValue % 100

    if (mod100 >= 11 && mod100 <= 14) {
        return forms[2]
    }
    if (mod10 === 1) {
        return forms[0]
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return forms[1]
    }
    return forms[2]
}

export type ExerciseSummaryTone = 'strength' | 'cardio' | 'timer'

export type ExerciseSummaryMeta = {
    tone: ExerciseSummaryTone
    label: string
    reason: string
    mobileReason: string
    icon: typeof Dumbbell
    className: string
    borderClass: string
}

export const getExerciseSummaryMeta = (exercise: CompletedExercise): ExerciseSummaryMeta => {
    const setsCount = exercise.sets_completed.length
    const firstSet = exercise.sets_completed[0]
    const hasWeight = firstSet?.weight != null && firstSet.weight > 0
    const hasReps = firstSet?.reps != null && firstSet.reps > 0
    const hasDuration = firstSet?.duration != null && firstSet.duration > 0

    if (hasDuration && !hasWeight && !hasReps) {
        return {
            tone: 'timer',
            label: setsCount > 1 ? 'Интервал' : 'Таймер',
            reason: setsCount > 1
                ? 'Есть несколько временных отрезков без повторов и рабочего веса.'
                : 'Есть длительность подхода без повторов и рабочего веса.',
            mobileReason: setsCount > 1 ? 'По времени, без веса' : 'Только время, без веса',
            icon: Timer,
            className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            borderClass: 'border-l-4 border-l-amber-400 dark:border-l-amber-500',
        }
    }
    if (hasDuration && !hasWeight) {
        return {
            tone: 'cardio',
            label: setsCount > 1 ? 'Интервалы' : 'Кардио',
            reason: hasReps
                ? 'Есть длительность подходов и работа строится по времени, а не по весу.'
                : 'Есть длительность активности без рабочего веса.',
            mobileReason: hasReps ? 'Работа по времени' : 'Длительность без веса',
            icon: HeartPulse,
            className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
            borderClass: 'border-l-4 border-l-rose-400 dark:border-l-rose-500',
        }
    }
    return {
        tone: 'strength',
        label: hasWeight ? 'Силовая' : 'Повторы',
        reason: hasWeight
            ? 'Карточка считается силовой, потому что в подходах указан рабочий вес.'
            : 'Карточка считается силовой, потому что в подходах есть повторы без временного интервала.',
        mobileReason: hasWeight ? 'Есть рабочий вес' : 'Повторы без таймера',
        icon: Dumbbell,
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        borderClass: 'border-l-4 border-l-blue-400 dark:border-l-blue-500',
    }
}

export const formatExerciseStructureSummary = (exercise: CompletedExercise): string => {
    const setsCount = exercise.sets_completed.length
    const firstSet = exercise.sets_completed[0]
    const parts: string[] = [
        `${setsCount} ${pluralizeRu(setsCount, ['подход', 'подхода', 'подходов'])}`,
    ]

    if (firstSet?.reps != null) {
        parts.push(`${firstSet.reps} ${pluralizeRu(firstSet.reps, ['повтор', 'повтора', 'повторов'])}`)
    }
    if (firstSet?.weight != null) {
        parts.push(`${firstSet.weight} ${pluralizeRu(firstSet.weight, ['килограмм', 'килограмма', 'килограммов'])}`)
    }
    if (firstSet?.duration != null) {
        parts.push(`${firstSet.duration} ${pluralizeRu(firstSet.duration, ['секунда', 'секунды', 'секунд'])}`)
    }

    return parts.join(' • ')
}
