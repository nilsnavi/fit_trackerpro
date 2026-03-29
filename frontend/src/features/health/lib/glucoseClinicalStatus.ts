import type { GlucoseUnit } from '@features/health/types/metrics'

/** Клинический диапазон глюкозы (как в трекере до выноса логики). */
export type GlucoseClinicalStatus = 'hypo' | 'low' | 'optimal' | 'high' | 'danger'

const RANGES_MMOL = {
    hypo: { max: 3.5 },
    low: { min: 3.5, max: 4.5 },
    optimal: { min: 4.5, max: 10 },
    high: { min: 10, max: 15 },
    danger: { min: 15 },
} as const

const RANGES_MGDL = {
    hypo: { max: 63 },
    low: { min: 63, max: 81 },
    optimal: { min: 81, max: 180 },
    high: { min: 180, max: 270 },
    danger: { min: 270 },
} as const

export function getGlucoseClinicalStatus(value: number, unit: GlucoseUnit): GlucoseClinicalStatus {
    const ranges = unit === 'mmol' ? RANGES_MMOL : RANGES_MGDL
    const val = unit === 'mmol' ? value : Math.round(value)

    if (val < ranges.hypo.max) return 'hypo'
    if (val >= ranges.low.min && val < ranges.low.max) return 'low'
    if (val >= ranges.optimal.min && val < ranges.optimal.max) return 'optimal'
    if (val >= ranges.high.min && val < ranges.high.max) return 'high'
    return 'danger'
}
