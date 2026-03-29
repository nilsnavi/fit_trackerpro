import type { ElementType } from 'react'

/** Зоны дискомфорта в чекине wellness (UI), не путать с `PainZones` — числовые оценки в API. */
export type PainZone =
    | 'shoulders'
    | 'knees'
    | 'back'
    | 'neck'
    | 'wrists'
    | 'hips'
    | 'ankles'
    | 'other'

export interface WorkoutRecommendation {
    level: 'full' | 'reduced' | 'rest'
    title: string
    description: string
    intensityModifier: number
    excludedZones: PainZone[]
    color: string
    icon: ElementType
}
