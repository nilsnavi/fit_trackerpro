import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { WorkoutTemplateResponse } from '@features/workouts/types/workouts'
import type { HomeWorkoutCardType, HomeWorkoutTemplate } from '@shared/types'

function backendTypeToHomeType(
    t: WorkoutTemplateResponse['type'],
): HomeWorkoutCardType {
    switch (t) {
        case 'strength':
            return 'strength'
        case 'cardio':
            return 'cardio'
        case 'flexibility':
            return 'yoga'
        case 'mixed':
            return 'functional'
        default:
            return 'strength'
    }
}

const THEME_BY_HOME_TYPE: Record<HomeWorkoutCardType, string> = {
    strength: 'from-blue-500 to-blue-600',
    cardio: 'from-red-500 to-red-600',
    yoga: 'from-green-500 to-green-600',
    functional: 'from-orange-500 to-orange-600',
    custom: 'from-purple-500 to-purple-600',
}

const ICON_BY_HOME_TYPE: Record<HomeWorkoutCardType, string> = {
    strength: 'dumbbell',
    cardio: 'heart',
    yoga: 'activity',
    functional: 'zap',
    custom: 'plus',
}

function lastWorkoutLabel(iso: string): string | undefined {
    try {
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return undefined
        return formatDistanceToNow(d, { addSuffix: true, locale: ru })
    } catch {
        return undefined
    }
}

export function workoutTemplateResponseToHomeCard(t: WorkoutTemplateResponse): HomeWorkoutTemplate {
    const type = backendTypeToHomeType(t.type)
    return {
        id: String(t.id),
        name: t.name,
        type,
        exerciseCount: t.exercises.length,
        lastWorkout: lastWorkoutLabel(t.updated_at),
        color: THEME_BY_HOME_TYPE[type],
        icon: ICON_BY_HOME_TYPE[type],
    }
}

export function customHomeWorkoutCard(): HomeWorkoutTemplate {
    return {
        id: 'custom',
        name: 'Своя',
        type: 'custom',
        exerciseCount: 0,
        color: THEME_BY_HOME_TYPE.custom,
        icon: ICON_BY_HOME_TYPE.custom,
    }
}
