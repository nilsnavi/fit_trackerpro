import type {
    GlucoseReading,
    WaterDailyStats,
    WellnessEntry,
} from '@features/health/types/metrics'
import {
    glucoseReadingToGlucoseData,
    waterDailyStatsToWaterData,
    wellnessEntryToWellnessData,
    wellnessScoreToMood,
} from '../mapHealthToDashboard'

function reading(value: number, unit: 'mmol' | 'mgdl' = 'mmol'): GlucoseReading {
    return {
        id: 1,
        user_id: 1,
        value,
        unit,
        measurement_type: 'random',
        recorded_at: '2026-02-10T08:00:00Z',
        created_at: '2026-02-10T08:00:00Z',
    }
}

function wellness(overrides: Partial<WellnessEntry> = {}): WellnessEntry {
    return {
        id: 1,
        user_id: 1,
        date: '2026-02-10',
        sleep_score: 70,
        sleep_hours: 7.5,
        energy_score: 60,
        pain_zones: {
            head: 0,
            neck: 0,
            shoulders: 0,
            chest: 0,
            back: 0,
            arms: 0,
            wrists: 0,
            hips: 0,
            knees: 0,
            ankles: 0,
        },
        created_at: '2026-02-10T08:00:00Z',
        updated_at: '2026-02-10T08:00:00Z',
        ...overrides,
    }
}

describe('mapHealthToDashboard', () => {
    it('переводит клинический статус глюкозы в статус виджета', () => {
        expect(glucoseReadingToGlucoseData(reading(5)).status).toBe('normal')
        expect(glucoseReadingToGlucoseData(reading(12)).status).toBe('high')
        expect(glucoseReadingToGlucoseData(reading(4)).status).toBe('low')
        expect(glucoseReadingToGlucoseData(reading(3)).status).toBe('critical')
        expect(glucoseReadingToGlucoseData(reading(130, 'mgdl'))).toEqual({
            value: 130,
            unit: 'мг/дл',
            status: 'normal',
            recorded_at: '2026-02-10T08:00:00Z',
        })
    })

    it('переносит дневную статистику воды в виджет', () => {
        const stats: WaterDailyStats = {
            date: '2026-02-10',
            total: 1200,
            goal: 2000,
            percentage: 60,
            is_goal_reached: false,
            entry_count: 3,
        }

        expect(waterDailyStatsToWaterData(stats)).toEqual({
            current: 1200,
            goal: 2000,
            unit: 'мл',
        })
    })

    it('без отметки самочувствия отдаёт null, а не нули', () => {
        expect(wellnessEntryToWellnessData(null)).toBeNull()
    })

    it('берёт оценку настроения, а без неё — энергию, и не пересчитывает шкалу 0..100', () => {
        expect(wellnessEntryToWellnessData(wellness({ mood_score: 88 }))).toEqual({
            score: 88,
            mood: 'great',
            note: undefined,
            recorded_at: '2026-02-10T08:00:00Z',
        })
        expect(wellnessEntryToWellnessData(wellness({ energy_score: 60 }))?.score).toBe(60)

        const entry = wellness({ mood_score: 50, notes: 'выспался' })
        expect(wellnessEntryToWellnessData(entry)).toMatchObject({
            score: 50,
            mood: 'okay',
            note: 'выспался',
        })
    })

    it('раскладывает шкалу 0..100 по настроениям', () => {
        expect(wellnessScoreToMood(100)).toBe('great')
        expect(wellnessScoreToMood(85)).toBe('great')
        expect(wellnessScoreToMood(70)).toBe('good')
        expect(wellnessScoreToMood(50)).toBe('okay')
        expect(wellnessScoreToMood(30)).toBe('bad')
        expect(wellnessScoreToMood(10)).toBe('terrible')
    })
})
