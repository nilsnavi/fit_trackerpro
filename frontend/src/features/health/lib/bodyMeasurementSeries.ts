/**
 * Чистые преобразования замеров тела для экрана здоровья (WS2-1).
 *
 * Экран показывает реальные данные вместо мока, поэтому вся арифметика
 * (последнее значение, дельта к предыдущему, точки графика) вынесена из
 * компонентов в отдельный модуль и покрыта тестами.
 */
import type { BodyMeasurement, BodyMeasurementType } from '@features/health/types/metrics'

export const BODY_MEASUREMENT_LABELS: Record<BodyMeasurementType, string> = {
    chest: 'Грудь',
    waist: 'Талия',
    hips: 'Бёдра',
    left_thigh: 'Левое бедро',
    right_thigh: 'Правое бедро',
    left_bicep: 'Левое плечо',
    right_bicep: 'Правое плечо',
}

export const BODY_MEASUREMENT_TYPES = Object.keys(
    BODY_MEASUREMENT_LABELS,
) as BodyMeasurementType[]

/** ISO-дата → `дд.мм` для подписи на оси графика. */
export function shortDate(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
        return iso
    }
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    return `${day}.${month}`
}

export interface MeasurementPoint {
    /** Исходный ISO-таймстемп — по нему сортируем, не по подписи. */
    date: string
    label: string
    value: number
}

export interface MeasurementSummary {
    type: BodyMeasurementType
    label: string
    latest: MeasurementPoint
    /** Предыдущий замер того же типа, если он есть — для дельты. */
    previous: MeasurementPoint | null
    deltaCm: number | null
    points: MeasurementPoint[]
}

function toPoint(measurement: BodyMeasurement): MeasurementPoint {
    return {
        date: measurement.measured_at,
        label: shortDate(measurement.measured_at),
        value: measurement.value_cm,
    }
}

function byMeasuredAtAsc(a: BodyMeasurement, b: BodyMeasurement): number {
    return new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
}

/** Точки одного типа в хронологическом порядке (старые → новые), не больше `limit`. */
export function seriesForType(
    items: BodyMeasurement[],
    type: BodyMeasurementType,
    limit = 12,
): MeasurementPoint[] {
    return items
        .filter((item) => item.measurement_type === type)
        // Ответ API не мутируем: сортировка работает на копии.
        .slice()
        .sort(byMeasuredAtAsc)
        .slice(-limit)
        .map(toPoint)
}

/**
 * Сводка по типам, у которых есть хотя бы один замер.
 * Порядок — по свежести последнего замера (свежие сверху).
 */
export function summarizeMeasurements(
    items: BodyMeasurement[],
    limit = 12,
): MeasurementSummary[] {
    return BODY_MEASUREMENT_TYPES.flatMap((type) => {
        const points = seriesForType(items, type, limit)
        const latest = points[points.length - 1]
        if (!latest) {
            return []
        }
        const previous = points.length > 1 ? points[points.length - 2] : null
        return [
            {
                type,
                label: BODY_MEASUREMENT_LABELS[type],
                latest,
                previous,
                deltaCm: previous ? Number((latest.value - previous.value).toFixed(1)) : null,
                points,
            },
        ]
    }).sort((a, b) => new Date(b.latest.date).getTime() - new Date(a.latest.date).getTime())
}

/** Тип с самым свежим замером — его график показываем по умолчанию. */
export function defaultMeasurementType(
    summaries: MeasurementSummary[],
): BodyMeasurementType | null {
    return summaries[0]?.type ?? null
}

/** Есть ли у типа достаточно данных для линии, а не для одной точки. */
export function hasTrend(points: MeasurementPoint[]): boolean {
    return points.length > 1
}

/** Дельта в сантиметрах → подпись и направление для UI. */
export function formatDelta(deltaCm: number | null): {
    text: string
    direction: 'up' | 'down' | 'flat'
} | null {
    if (deltaCm === null) {
        return null
    }
    if (deltaCm === 0) {
        return { text: 'без изменений', direction: 'flat' }
    }
    const sign = deltaCm > 0 ? '+' : '−'
    return { text: `${sign}${Math.abs(deltaCm)} см`, direction: deltaCm > 0 ? 'up' : 'down' }
}
