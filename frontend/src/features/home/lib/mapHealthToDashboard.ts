import type {
    GlucoseReading,
    GlucoseUnit,
    WaterDailyStats,
    WellnessEntry,
} from '@features/health/types/metrics'
import type {
    GlucoseData,
    GlucoseWidgetStatus,
    WaterData,
    WellnessData,
    WellnessWidgetMood,
} from '@shared/types'
import {
    getGlucoseClinicalStatus,
    type GlucoseClinicalStatus,
} from '@features/health/lib/glucoseClinicalStatus'

const GLUCOSE_UNIT_LABEL: Record<GlucoseUnit, string> = {
    mmol: 'ммоль/л',
    mgdl: 'мг/дл',
}

function clinicalToWidgetStatus(clinical: GlucoseClinicalStatus): GlucoseWidgetStatus {
    switch (clinical) {
        case 'hypo':
        case 'danger':
            return 'critical'
        case 'low':
            return 'low'
        case 'optimal':
            return 'normal'
        case 'high':
            return 'high'
    }
}

/** Последний замер API → данные виджета «Глюкоза» на главной. */
export function glucoseReadingToGlucoseData(reading: GlucoseReading): GlucoseData {
    const clinical = getGlucoseClinicalStatus(reading.value, reading.unit)
    return {
        value: reading.value,
        unit: GLUCOSE_UNIT_LABEL[reading.unit],
        status: clinicalToWidgetStatus(clinical),
        recorded_at: reading.recorded_at,
    }
}

/** Дневная статистика воды → прогресс для виджета (текущий объём / цель). */
export function waterDailyStatsToWaterData(
    stats: WaterDailyStats,
    unitLabel = 'мл',
): WaterData {
    return {
        current: stats.total,
        goal: stats.goal,
        unit: unitLabel,
    }
}

/**
 * Оценка самочувствия 0..100 → настроение виджета.
 * Шкалу не пересчитываем: виджет показывает те же 0..100, что и API.
 */
export function wellnessScoreToMood(score: number): WellnessWidgetMood {
    if (score >= 85) return 'great'
    if (score >= 65) return 'good'
    if (score >= 45) return 'okay'
    if (score >= 25) return 'bad'
    return 'terrible'
}

/**
 * Дневная отметка самочувствия → данные виджета «Самочувствие» на главной.
 * Без отметки возвращаем null: виджет показывает «Нет данных», а не нули.
 */
export function wellnessEntryToWellnessData(entry: WellnessEntry | null): WellnessData | null {
    if (!entry) return null
    const score = Math.round(entry.mood_score ?? entry.energy_score)
    return {
        score,
        mood: wellnessScoreToMood(score),
        note: entry.notes,
        recorded_at: entry.created_at,
    }
}
