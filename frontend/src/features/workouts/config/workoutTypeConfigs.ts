import {
    Activity,
    Dumbbell,
    HeartPulse,
    MoreHorizontal,
    Trophy,
    Wind,
} from 'lucide-react'
import type { WorkoutType } from '@shared/types'
import type { WorkoutSessionField, WorkoutTypeConfig } from '../types/workoutTypeConfig'

const cardio: WorkoutTypeConfig = {
    id: 'cardio',
    mode: 'cardio',
    listTypes: ['cardio'],
    title: 'Кардио',
    filterLabel: 'Кардио',
    subtitle: 'Выносливость и пульс',
    description: 'Бег, вело и интервальные кардио-сессии.',
    themeClass: 'from-red-500 to-orange-500',
    listBadgeClass: 'bg-red-500',
    icon: HeartPulse,
    backendType: 'cardio',
    defaultDurationMinutes: 30,
    presets: [
        { id: 'cardio-20', label: '20 мин', value: 20, unit: 'minutes' },
        { id: 'cardio-30', label: '30 мин', value: 30, unit: 'minutes' },
        { id: 'cardio-45', label: '45 мин', value: 45, unit: 'minutes' },
    ],
    tags: ['cardio'],
    parameters: {
        estimatedCaloriesPerMinute: 9,
        defaultIntensity: 'medium',
    },
    fields: {
        session: ['duration', 'calories', 'intensity', 'heart_rate', 'distance', 'pace', 'notes', 'exercises'],
        exerciseSet: ['duration', 'reps', 'distance', 'notes'],
    },
    timers: {
        primary: 'session_countdown',
        defaultRestSeconds: 45,
        showRestBetweenSets: false,
    },
    hints: {
        modeIntro: 'Фокус на длительности и пульсе; подходы с временем в секундах.',
        presetPicker: 'Выберите ориентировочную длительность — её можно изменить после старта.',
        emptyHistory: 'Добавьте кардио-тренировку через режим «Кардио» или конструктор.',
        builder: 'Для кардио-блоков задавайте время шага в минутах — оно уйдёт в длительность подхода.',
    },
    ux: {
        showPresetPicker: true,
        emphasizeRoundsInPresets: false,
        showCaloriesInSummary: true,
        compactExerciseCards: true,
        intensityHint: 'Для кардио интенсивность часто совпадает с зоной пульса.',
    },
}

const strength: WorkoutTypeConfig = {
    id: 'strength',
    mode: 'strength',
    listTypes: ['strength'],
    title: 'Силовая',
    filterLabel: 'Силовая',
    subtitle: 'Подходы и прогрессия',
    description: 'Тренировка с весами и отслеживанием подходов.',
    themeClass: 'from-blue-500 to-indigo-500',
    listBadgeClass: 'bg-blue-500',
    icon: Dumbbell,
    backendType: 'strength',
    defaultDurationMinutes: 45,
    presets: [
        { id: 'strength-3', label: '3 круга', value: 3, unit: 'rounds' },
        { id: 'strength-4', label: '4 круга', value: 4, unit: 'rounds' },
        { id: 'strength-5', label: '5 кругов', value: 5, unit: 'rounds' },
    ],
    tags: ['strength'],
    parameters: {
        estimatedCaloriesPerMinute: 6,
        defaultIntensity: 'high',
    },
    fields: {
        session: ['duration', 'calories', 'intensity', 'notes', 'exercises'],
        exerciseSet: ['sets', 'reps', 'weight', 'rpe', 'rest_between_sets', 'notes'],
    },
    timers: {
        primary: 'stopwatch',
        defaultRestSeconds: 90,
        showRestBetweenSets: true,
    },
    hints: {
        modeIntro: 'Между подходами включайте отдых — таймер подскажет, когда продолжить.',
        presetPicker: 'Круги — ориентир объёма; фактическое число упражнений задаётся в журнале.',
        emptyHistory: 'Начните силовую с режима «Силовая» или соберите шаблон в конструкторе.',
        builder: 'Силовые блоки: вес, повторы и отдых между подходами попадут в шаблон.',
    },
    ux: {
        showPresetPicker: true,
        emphasizeRoundsInPresets: true,
        showCaloriesInSummary: true,
        compactExerciseCards: false,
        intensityHint: 'RPE или субъективная тяжесть помогут отслеживать прогрессию.',
    },
}

const functional: WorkoutTypeConfig = {
    id: 'functional',
    mode: 'functional',
    listTypes: [],
    title: 'Функционал',
    filterLabel: 'Функционал',
    subtitle: 'HIIT и круговая работа',
    description: 'Интервальная нагрузка на всё тело.',
    themeClass: 'from-amber-500 to-orange-500',
    listBadgeClass: 'bg-amber-500',
    icon: Activity,
    backendType: 'mixed',
    defaultDurationMinutes: 25,
    presets: [
        { id: 'functional-3', label: '3 круга', value: 3, unit: 'rounds' },
        { id: 'functional-5', label: '5 кругов', value: 5, unit: 'rounds' },
        { id: 'functional-7', label: '7 кругов', value: 7, unit: 'rounds' },
    ],
    tags: ['mixed', 'functional', 'hiit'],
    parameters: {
        estimatedCaloriesPerMinute: 10,
        defaultIntensity: 'high',
    },
    fields: {
        session: ['duration', 'calories', 'intensity', 'notes', 'exercises'],
        exerciseSet: ['sets', 'reps', 'duration', 'rest_between_sets', 'notes'],
    },
    timers: {
        primary: 'interval',
        defaultRestSeconds: 30,
        showRestBetweenSets: true,
        suggestedWorkSeconds: 40,
        suggestedIntervalRestSeconds: 20,
    },
    hints: {
        modeIntro: 'Чередуйте работу и отдых; пресеты задают число кругов.',
        presetPicker: 'Интервалы можно уточнить по упражнениям в журнале после старта.',
        builder: 'Смешивайте силовые и кардио-блоки — тип шаблона на бэкенде будет mixed.',
    },
    ux: {
        showPresetPicker: true,
        emphasizeRoundsInPresets: true,
        showCaloriesInSummary: true,
        compactExerciseCards: true,
        intensityHint: 'HIIT обычно high; при кругах средней интенсивности выберите medium.',
    },
}

const yoga: WorkoutTypeConfig = {
    id: 'yoga',
    mode: 'yoga',
    listTypes: ['flexibility'],
    title: 'Йога',
    filterLabel: 'Гибкость',
    subtitle: 'Мобилити и дыхание',
    description: 'Спокойная практика с настройкой таймера и ритма.',
    themeClass: 'from-green-500 to-emerald-500',
    listBadgeClass: 'bg-green-500',
    icon: Wind,
    backendType: 'flexibility',
    defaultDurationMinutes: 20,
    presets: [
        { id: 'yoga-10', label: '10 мин', value: 10, unit: 'minutes' },
        { id: 'yoga-20', label: '20 мин', value: 20, unit: 'minutes' },
        { id: 'yoga-30', label: '30 мин', value: 30, unit: 'minutes' },
    ],
    tags: ['flexibility', 'yoga'],
    parameters: {
        estimatedCaloriesPerMinute: 3,
        defaultIntensity: 'low',
    },
    fields: {
        session: ['duration', 'calories', 'intensity', 'notes', 'exercises'],
        exerciseSet: ['duration', 'notes'],
    },
    timers: {
        primary: 'session_countdown',
        defaultRestSeconds: 15,
        showRestBetweenSets: false,
    },
    hints: {
        modeIntro: 'Длительность задаётся пресетом; позы можно логировать как упражнения с удержанием.',
        presetPicker: 'Выберите длительность практики — её можно скорректировать при завершении.',
        emptyHistory: 'Практики гибкости попадают сюда по тегам или типу «Гибкость».',
        builder: 'Для растяжки удобны блоки с длительностью удержания.',
    },
    ux: {
        showPresetPicker: true,
        emphasizeRoundsInPresets: false,
        showCaloriesInSummary: false,
        compactExerciseCards: true,
        intensityHint: 'Часто low или medium — без перегруза суставов.',
    },
}

const sports: WorkoutTypeConfig = {
    id: 'sports',
    listTypes: ['sports'],
    title: 'Спорт',
    filterLabel: 'Спорт',
    subtitle: 'Игровые и командные виды',
    description: 'Футбол, баскетбол, теннис и другие активности.',
    themeClass: 'from-violet-500 to-purple-600',
    listBadgeClass: 'bg-purple-500',
    icon: Trophy,
    backendType: 'mixed',
    defaultDurationMinutes: 60,
    presets: [
        { id: 'sports-45', label: '45 мин', value: 45, unit: 'minutes' },
        { id: 'sports-60', label: '60 мин', value: 60, unit: 'minutes' },
        { id: 'sports-90', label: '90 мин', value: 90, unit: 'minutes' },
    ],
    tags: ['sports', 'sport'],
    parameters: {
        estimatedCaloriesPerMinute: 8,
        defaultIntensity: 'medium',
    },
    fields: {
        session: ['duration', 'calories', 'intensity', 'heart_rate', 'notes', 'exercises'],
        exerciseSet: ['duration', 'reps', 'notes'],
    },
    timers: {
        primary: 'stopwatch',
        defaultRestSeconds: 60,
        showRestBetweenSets: false,
    },
    hints: {
        emptyHistory: 'Отметьте игру или тренировку по виду спорта — тег sport поможет фильтру.',
        builder: 'Тип «Спорт» на бэкенде мапится в mixed при сохранении шаблона.',
    },
    ux: {
        showPresetPicker: false,
        emphasizeRoundsInPresets: false,
        showCaloriesInSummary: true,
        compactExerciseCards: true,
    },
}

const other: WorkoutTypeConfig = {
    id: 'other',
    listTypes: ['other'],
    title: 'Другое',
    filterLabel: 'Другое',
    subtitle: 'Произвольная активность',
    description: 'Всё, что не попало в остальные категории.',
    themeClass: 'from-gray-500 to-slate-600',
    listBadgeClass: 'bg-gray-500',
    icon: MoreHorizontal,
    backendType: 'mixed',
    defaultDurationMinutes: 30,
    presets: [
        { id: 'other-15', label: '15 мин', value: 15, unit: 'minutes' },
        { id: 'other-30', label: '30 мин', value: 30, unit: 'minutes' },
        { id: 'other-45', label: '45 мин', value: 45, unit: 'minutes' },
    ],
    tags: ['other'],
    parameters: {
        estimatedCaloriesPerMinute: 5,
        defaultIntensity: 'medium',
    },
    fields: {
        session: ['duration', 'calories', 'intensity', 'notes', 'exercises'],
        exerciseSet: ['sets', 'reps', 'weight', 'duration', 'notes'],
    },
    timers: {
        primary: 'stopwatch',
        defaultRestSeconds: 60,
        showRestBetweenSets: false,
    },
    hints: {
        emptyHistory: 'Сюда попадают тренировки без явных тегов типа.',
        builder: 'Комбинируйте типы блоков — итоговый тип шаблона может стать mixed.',
    },
    ux: {
        showPresetPicker: false,
        emphasizeRoundsInPresets: false,
        showCaloriesInSummary: true,
        compactExerciseCards: false,
    },
}

/**
 * Реестр режимов быстрого старта (`/workouts/mode/:mode`).
 * Новый режим: добавьте объект в этот map — тип `WorkoutMode` и страница подхватятся без копипасты.
 */
export const WORKOUT_TYPE_CONFIGS = {
    cardio,
    strength,
    functional,
    yoga,
} as const satisfies Record<string, WorkoutTypeConfig>

export type WorkoutMode = keyof typeof WORKOUT_TYPE_CONFIGS

/** Порядок карточек режимов на экране «Тренировки». */
export const WORKOUT_MODE_ORDER = ['strength', 'cardio', 'functional', 'yoga'] as const satisfies readonly WorkoutMode[]

/** Все определения типов (режимы + типы только для списка/фильтров). */
export const WORKOUT_TYPE_DEFINITIONS: WorkoutTypeConfig[] = [
    ...WORKOUT_MODE_ORDER.map((m) => WORKOUT_TYPE_CONFIGS[m]),
    sports,
    other,
]

/** Конфиг для фильтров и строк истории по значению `WorkoutType` из БД/клиента. */
export const WORKOUT_LIST_TYPE_CONFIG: Record<WorkoutType, WorkoutTypeConfig> = {
    cardio,
    strength,
    flexibility: yoga,
    sports,
    other,
}

/** Порядок чипов фильтра (без «Все»). */
export const WORKOUT_FILTER_TYPE_ORDER: WorkoutType[] = [
    'cardio',
    'strength',
    'flexibility',
    'sports',
    'other',
]

/** Короткие подписи типа для календаря и внешних списков. */
export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    cardio: WORKOUT_LIST_TYPE_CONFIG.cardio.filterLabel,
    strength: WORKOUT_LIST_TYPE_CONFIG.strength.filterLabel,
    flexibility: WORKOUT_LIST_TYPE_CONFIG.flexibility.filterLabel,
    sports: WORKOUT_LIST_TYPE_CONFIG.sports.filterLabel,
    other: WORKOUT_LIST_TYPE_CONFIG.other.filterLabel,
}

export function getWorkoutListTypeConfig(type: WorkoutType): WorkoutTypeConfig {
    return WORKOUT_LIST_TYPE_CONFIG[type]
}

/** Оценка ккал из длительности, если нет фактических данных. */
export function estimateCaloriesForType(
    type: WorkoutType,
    durationMinutes: number,
): number {
    const rate = WORKOUT_LIST_TYPE_CONFIG[type].parameters.estimatedCaloriesPerMinute
    return Math.round(durationMinutes * rate)
}

/** Проверка, входит ли поле в конфиг типа (сессия или подход). */
export function workoutTypeHasField(
    type: WorkoutType,
    scope: 'session' | 'exerciseSet',
    field: WorkoutSessionField,
): boolean {
    const cfg = WORKOUT_LIST_TYPE_CONFIG[type]
    return cfg.fields[scope].includes(field)
}
