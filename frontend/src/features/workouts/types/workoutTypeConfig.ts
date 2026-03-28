import type { LucideIcon } from 'lucide-react'
import type { WorkoutType } from '@shared/types'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'

/** Поля сессии / упражнения, которыми можно управлять из конфига (рендер форм, итоги). */
export type WorkoutSessionField =
    | 'duration'
    | 'calories'
    | 'intensity'
    | 'heart_rate'
    | 'distance'
    | 'pace'
    | 'sets'
    | 'reps'
    | 'weight'
    | 'rpe'
    | 'rest_between_sets'
    | 'notes'
    | 'exercises'

export type PrimaryTimerKind = 'session_countdown' | 'interval' | 'stopwatch' | 'none'

export interface WorkoutTimersConfig {
    /** Основной таймер UX для этого типа. */
    primary: PrimaryTimerKind
    /** Отдых между подходами по умолчанию (сек). */
    defaultRestSeconds: number
    /** Показывать таймер отдыха между подходами. */
    showRestBetweenSets: boolean
    /** Длительность «работы» в интервале (сек), подсказка для HIIT. */
    suggestedWorkSeconds?: number
    /** Длительность отдыха в интервале (сек). */
    suggestedIntervalRestSeconds?: number
}

export interface WorkoutUxConfig {
    /** Экран выбора пресета перед стартом. */
    showPresetPicker: boolean
    /** В пресетах акцент на кругах, а не на минутах. */
    emphasizeRoundsInPresets: boolean
    /** Показывать сожжённые ккал в сводках списка. */
    showCaloriesInSummary: boolean
    /** Компактные карточки упражнений в деталях. */
    compactExerciseCards: boolean
    /** Подсказка для поля интенсивности в конструкторе/логе. */
    intensityHint?: string
}

export interface WorkoutPreset {
    id: string
    label: string
    value: number
    unit: 'minutes' | 'rounds'
}

/** Расширяемые числовые/булевы параметры типа (метаболизм, дефолты). */
export interface WorkoutTypeParameters {
    /** Оценка ккал/мин для сводок, если нет данных с датчиков. */
    estimatedCaloriesPerMinute: number
    /** Интенсивность по умолчанию для новых записей. */
    defaultIntensity: 'low' | 'medium' | 'high'
}

export interface WorkoutTypeHints {
    /** Короткий текст под заголовком на экране режима. */
    modeIntro?: string
    /** Под блоком пресетов. */
    presetPicker?: string
    /** Пустой список истории для этого фильтра. */
    emptyHistory?: string
    /** Подсказка в конструкторе шаблона. */
    builder?: string
}

export interface WorkoutTypeConfig {
    /** Стабильный id записи в реестре. */
    id: string
    /** Если задан — сегмент `/workouts/mode/:mode` и ключ в `WORKOUT_TYPE_CONFIGS`. */
    mode?: string
    /**
     * Какие значения `WorkoutType` (БД/фильтры) отображаются этим конфигом.
     * У режима без записи в списке (например functional) — пусто.
     */
    listTypes: WorkoutType[]
    /** Заголовок карточки режима / экрана. */
    title: string
    /** Подпись в фильтрах и чипах (если отличается от title). */
    filterLabel: string
    subtitle: string
    description: string
    /** Градиент карточки режима (Tailwind). */
    themeClass: string
    /** Сплошная заливка бейджа в списках (Tailwind bg-*). */
    listBadgeClass: string
    icon: LucideIcon
    backendType: BackendWorkoutType
    defaultDurationMinutes: number
    presets: WorkoutPreset[]
    /** Теги для старта/шаблонов и эвристик истории. */
    tags: string[]
    parameters: WorkoutTypeParameters
    /** Какие поля показывать на уровне сессии и подхода. */
    fields: {
        session: WorkoutSessionField[]
        exerciseSet: WorkoutSessionField[]
    }
    timers: WorkoutTimersConfig
    hints: WorkoutTypeHints
    ux: WorkoutUxConfig
}
