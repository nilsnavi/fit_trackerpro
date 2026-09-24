/**
 * Главная показывает здоровье только на реальных данных (WS2-2): виджеты не
 * должны получать выдуманные значения, а пустая отметка — превращаться в ноль.
 */
import { renderHook } from '@testing-library/react'
import {
    useGlucoseReadingsQuery,
    useWellnessByDateQuery,
} from '@features/health/hooks/useHealthQueries'
import { useHomeWaterQuery } from '@features/home/hooks/useHomeWaterQuery'
import { useHomeHealthWidgets } from '../useHomeHealthWidgets'

jest.mock('@features/health/hooks/useHealthQueries', () => ({
    useGlucoseReadingsQuery: jest.fn(),
    useWellnessByDateQuery: jest.fn(),
}))
jest.mock('@features/home/hooks/useHomeWaterQuery', () => ({
    useHomeWaterQuery: jest.fn(),
}))

const mockedWater = useHomeWaterQuery as jest.Mock
const mockedGlucose = useGlucoseReadingsQuery as jest.Mock
const mockedWellness = useWellnessByDateQuery as jest.Mock

const today = new Date().toISOString().slice(0, 10)

function query(overrides: Record<string, unknown> = {}) {
    return { data: undefined, isPending: false, isError: false, refetch: jest.fn(), ...overrides }
}

describe('useHomeHealthWidgets', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedWater.mockReturnValue(
            query({ data: { current: 500, goal: 2000, unit: 'мл' } }),
        )
        mockedGlucose.mockReturnValue(query({ data: [] }))
        mockedWellness.mockReturnValue(query({ data: [] }))
    })

    it('отдаёт виджетам реальные данные воды, последнего замера глюкозы и отметки за сегодня', () => {
        mockedGlucose.mockReturnValue(
            query({
                data: [
                    {
                        id: 1,
                        user_id: 1,
                        value: 5.2,
                        unit: 'mmol',
                        measurement_type: 'random',
                        recorded_at: '2026-02-10T08:00:00Z',
                        created_at: '2026-02-10T08:00:00Z',
                    },
                ],
            }),
        )
        mockedWellness.mockReturnValue(
            query({
                data: [
                    {
                        id: 2,
                        user_id: 1,
                        date: today,
                        sleep_score: 80,
                        energy_score: 70,
                        pain_zones: { head: 0 },
                        created_at: '2026-02-10T08:00:00Z',
                        updated_at: '2026-02-10T08:00:00Z',
                    },
                ],
            }),
        )

        const { result } = renderHook(() => useHomeHealthWidgets())

        expect(result.current.water).toEqual({ current: 500, goal: 2000, unit: 'мл' })
        expect(result.current.glucose).toMatchObject({ value: 5.2, unit: 'ммоль/л' })
        // mood_score в отметке нет — берётся энергия (70 из 100), шкала не пересчитывается.
        expect(result.current.wellness).toMatchObject({ score: 70, mood: 'good' })
        expect(result.current.isError).toBe(false)
    })

    it('без данных отдаёт null, чтобы виджет показал «Нет данных», а не нули', () => {
        const { result } = renderHook(() => useHomeHealthWidgets())

        expect(result.current.water).toEqual({ current: 500, goal: 2000, unit: 'мл' })
        expect(result.current.glucose).toBeNull()
        expect(result.current.wellness).toBeNull()
    })

    it('сообщает о загрузке и об ошибке, а refetch повторяет все три запроса', async () => {
        const waterRefetch = jest.fn().mockResolvedValue(undefined)
        const glucoseRefetch = jest.fn().mockResolvedValue(undefined)
        const wellnessRefetch = jest.fn().mockResolvedValue(undefined)
        mockedWater.mockReturnValue(query({ isPending: true, refetch: waterRefetch }))
        mockedGlucose.mockReturnValue(query({ isError: true, refetch: glucoseRefetch }))
        mockedWellness.mockReturnValue(query({ refetch: wellnessRefetch }))

        const { result } = renderHook(() => useHomeHealthWidgets())
        expect(result.current.isPending).toBe(true)
        expect(result.current.isError).toBe(true)

        await result.current.refetch()

        expect(waterRefetch).toHaveBeenCalledTimes(1)
        expect(glucoseRefetch).toHaveBeenCalledTimes(1)
        expect(wellnessRefetch).toHaveBeenCalledTimes(1)
    })
})
