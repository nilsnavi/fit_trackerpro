import type { BackendWorkoutType } from '@features/workouts/types/workouts'

export interface SmartRestParams {
    /** Фактический отдых в прошлый раз (секунды) */
    previousRest?: number
    /** RPE последнего подхода (1-10) */
    rpe?: number
    /** Тип упражнения */
    exerciseType?: ExerciseCategory
    /** Дефолтный отдых пользователя (секунды) */
    defaultRest: number
    /** Тип тренировки (для контекста) */
    workoutType?: BackendWorkoutType
}

export type ExerciseCategory = 'compound' | 'isolation' | 'cardio' | 'flexibility' | 'unknown'

/**
 * Базовые значения отдыха по типу упражнения (в секундах).
 */
const BASE_REST_BY_CATEGORY: Record<ExerciseCategory, number> = {
    compound: 120, // Присед, становая, жим — 2 мин
    isolation: 60, // Бицепс, трицепс, дельты — 1 мин
    cardio: 30, // Кардио-интервалы — 30 сек
    flexibility: 45, // Растяжка — 45 сек
    unknown: 90, // Дефолт
}

/**
 * Множители отдыха по RPE.
 * RPE 8-10: нужно больше отдыха
 * RPE 6-7: стандартный отдых
 * RPE 1-5: можно меньше отдыха
 */
const RPE_REST_ADJUSTMENTS: Record<string, number> = {
    high: 30, // RPE 8-10: +30 сек
    medium: 0, // RPE 6-7: без изменений
    low: -15, // RPE 1-5: -15 сек
}

/**
 * Определяет категорию упражнения по названию.
 */
export function classifyExerciseCategory(name: string): ExerciseCategory {
    const lowerName = name.toLowerCase()

    // Compound movements
    const compoundKeywords = [
        'присед', 'squat', 'становая', 'deadlift', 'жим', 'bench', 'жим лежа',
        'жим стоя', 'overhead press', 'фронтальный присед', 'front squat',
        'выпад', 'lunge', 'тяга', 'row', 'подтягивания', 'pull-up',
    ]
    if (compoundKeywords.some((kw) => lowerName.includes(kw))) {
        return 'compound'
    }

    // Isolation movements
    const isolationKeywords = [
        'бицепс', 'bicep', 'трицепс', 'tricep', 'разгибание', 'extension',
        'сгибание', 'curl', 'мах', 'raise', 'разводка', 'fly',
        'икры', 'calf', 'предплечье', 'forearm',
    ]
    if (isolationKeywords.some((kw) => lowerName.includes(kw))) {
        return 'isolation'
    }

    // Cardio movements
    const cardioKeywords = [
        'бег', 'run', 'велотренажёр', 'bike', 'эллипс', 'elliptical',
        'гребля', 'row machine', 'скакалка', 'jump rope', 'берпи', 'burpee',
        'прыжки', 'jump', 'интервал', 'interval', 'hiit',
    ]
    if (cardioKeywords.some((kw) => lowerName.includes(kw))) {
        return 'cardio'
    }

    // Flexibility/mobility
    const flexibilityKeywords = [
        'растяжка', 'stretch', 'йога', 'yoga', 'мобильность', 'mobility',
        'разминка', 'warmup', 'заминка', 'cooldown',
    ]
    if (flexibilityKeywords.some((kw) => lowerName.includes(kw))) {
        return 'flexibility'
    }

    return 'unknown'
}

/**
 * Определяет уровень RPE для корректировки отдыха.
 */
function getRpeLevel(rpe?: number): 'high' | 'medium' | 'low' {
    if (rpe == null) return 'medium'
    if (rpe >= 8) return 'high'
    if (rpe >= 6) return 'medium'
    return 'low'
}

/**
 * Рассчитывает умное время отдыха на основе параметров.
 *
 * @returns Время отдыха в секундах
 */
export function calculateSmartRest(params: SmartRestParams): number {
    const { previousRest, rpe, exerciseType = 'unknown', defaultRest } = params

    // Базовое время отдыха по типу упражнения
    let baseRest = BASE_REST_BY_CATEGORY[exerciseType]

    // Если есть дефолтный отдых пользователя, используем его как основу
    if (defaultRest > 0) {
        baseRest = defaultRest
    }

    // Корректировка по RPE
    const rpeLevel = getRpeLevel(rpe)
    const rpeAdjustment = RPE_REST_ADJUSTMENTS[rpeLevel]

    let calculatedRest = baseRest + rpeAdjustment

    // Если есть предыдущий отдых, учитываем его (усредняем с расчётным)
    if (previousRest != null && previousRest > 0) {
        // Взвешенное среднее: 60% расчётного + 40% предыдущего
        calculatedRest = Math.round(calculatedRest * 0.6 + previousRest * 0.4)
    }

    // Минимум 15 секунд, максимум 5 минут
    return Math.max(15, Math.min(300, calculatedRest))
}

/**
 * Константы пресетов отдыха.
 */
export const REST_PRESETS = [60, 90, 120, 180] as const
export type RestPreset = (typeof REST_PRESETS)[number]

/**
 * Форматирует время отдыха в читаемый формат.
 */
export function formatRestTime(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}с`
    }
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (secs === 0) {
        return `${mins} мин`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
}
