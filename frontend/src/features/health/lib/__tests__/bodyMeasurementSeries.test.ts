import type { BodyMeasurement, BodyMeasurementType } from '@features/health/types/metrics'
import {
    BODY_MEASUREMENT_LABELS,
    defaultMeasurementType,
    formatDelta,
    hasTrend,
    seriesForType,
    shortDate,
    summarizeMeasurements,
} from '../bodyMeasurementSeries'

function measurement(
    id: number,
    type: BodyMeasurementType,
    valueCm: number,
    measuredAt: string,
): BodyMeasurement {
    return {
        id,
        user_id: 1,
        measurement_type: type,
        value_cm: valueCm,
        measured_at: measuredAt,
        created_at: measuredAt,
        updated_at: measuredAt,
    }
}

describe('bodyMeasurementSeries', () => {
    it('ставит точки одного типа в хронологическом порядке и не мутирует ответ API', () => {
        const items = [
            measurement(1, 'waist', 81, '2026-02-10T08:00:00Z'),
            measurement(2, 'chest', 102, '2026-02-12T08:00:00Z'),
            measurement(3, 'waist', 79, '2026-02-01T08:00:00Z'),
        ]
        const snapshot = [...items]

        const points = seriesForType(items, 'waist')

        expect(points.map((p) => p.value)).toEqual([79, 81])
        expect(items).toEqual(snapshot)
    })

    it('ограничивает серию последними замерами', () => {
        const items = Array.from({ length: 5 }, (_, index) =>
            measurement(index + 1, 'hips', 90 + index, `2026-01-0${index + 1}T08:00:00Z`),
        )

        const points = seriesForType(items, 'hips', 2)

        expect(points.map((p) => p.value)).toEqual([93, 94])
    })

    it('считает последнее значение, предыдущее и дельту, а типы без данных не показывает', () => {
        const items = [
            measurement(1, 'chest', 100, '2026-01-01T08:00:00Z'),
            measurement(2, 'chest', 102.5, '2026-01-20T08:00:00Z'),
            measurement(3, 'waist', 80, '2026-02-02T08:00:00Z'),
        ]

        const summaries = summarizeMeasurements(items)

        expect(summaries.map((s) => s.type)).toEqual(['waist', 'chest'])
        const chest = summaries.find((s) => s.type === 'chest')!
        expect(chest.latest.value).toBe(102.5)
        expect(chest.previous?.value).toBe(100)
        expect(chest.deltaCm).toBe(2.5)
        expect(chest.label).toBe(BODY_MEASUREMENT_LABELS.chest)

        const waist = summaries.find((s) => s.type === 'waist')!
        expect(waist.previous).toBeNull()
        expect(waist.deltaCm).toBeNull()
    })

    it('по умолчанию предлагает тип с самым свежим замером', () => {
        const summaries = summarizeMeasurements([
            measurement(1, 'chest', 100, '2026-01-01T08:00:00Z'),
            measurement(2, 'hips', 95, '2026-03-01T08:00:00Z'),
        ])

        expect(defaultMeasurementType(summaries)).toBe('hips')
        expect(defaultMeasurementType([])).toBeNull()
    })

    it('различает один замер и линию, а дельту переводит в текст', () => {
        expect(hasTrend([])).toBe(false)
        expect(hasTrend([{ date: '2026-01-01T08:00:00Z', label: '01.01', value: 100 }])).toBe(false)
        expect(
            hasTrend([
                { date: '2026-01-01T08:00:00Z', label: '01.01', value: 100 },
                { date: '2026-01-08T08:00:00Z', label: '08.01', value: 101 },
            ]),
        ).toBe(true)

        expect(formatDelta(null)).toBeNull()
        expect(formatDelta(0)).toEqual({ text: 'без изменений', direction: 'flat' })
        expect(formatDelta(2.5)).toEqual({ text: '+2.5 см', direction: 'up' })
        expect(formatDelta(-1)).toEqual({ text: '−1 см', direction: 'down' })
    })

    it('подписывает ось датой и не падает на некорректном значении', () => {
        expect(shortDate('2026-02-09T08:00:00Z')).toBe('09.02')
        expect(shortDate('не дата')).toBe('не дата')
    })
})
