import type { GlucoseReading, GlucoseUnit, WaterDailyStats } from '@features/health/types/metrics'
import type { GlucoseData, GlucoseWidgetStatus, WaterData } from '@shared/types'
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
