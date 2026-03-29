/** Обратная совместимость: типы дашборда перенесены в @shared/types/homeDashboard. */

export type {
    GlucoseData,
    GlucoseWidgetStatus,
    WellnessData,
    WellnessWidgetMood,
    WaterData,
    HomeWorkoutTemplate,
    HomeWorkoutCardType,
} from '@shared/types'

/** Прежнее имя карточки тренировки на главной. */
export type { HomeWorkoutTemplate as WorkoutTemplate } from '@shared/types'
