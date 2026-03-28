import type { PrimaryTimerKind, WorkoutTypeConfig } from '../types/workoutTypeConfig'
import { WORKOUT_TYPE_CONFIGS, type WorkoutMode } from '../config/workoutTypeConfigs'

export const PRIMARY_TIMER_HINTS: Record<PrimaryTimerKind, string> = {
    session_countdown: 'Ориентир по длительности сессии',
    interval: 'Чередование работы и отдыха',
    stopwatch: 'Свободная длительность, старт/стоп вручную',
    none: 'Таймер не обязателен для этого типа',
}

const MODE_KEYS = new Set<string>(Object.keys(WORKOUT_TYPE_CONFIGS))

export function isWorkoutModeParam(value: string | undefined): value is WorkoutMode {
    return Boolean(value && MODE_KEYS.has(value))
}

/** Конфиг экрана быстрого старта по сегменту маршрута `:mode`. */
export function getWorkoutModePageConfig(modeParam: string | undefined): WorkoutTypeConfig | null {
    if (!isWorkoutModeParam(modeParam)) return null
    return WORKOUT_TYPE_CONFIGS[modeParam]
}
