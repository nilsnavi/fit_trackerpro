import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMuscleLoadTable, useTrainingLoadDailyTable } from '../useLoadTables'
import {
    getAnalyticsMuscleLoadTable,
    getAnalyticsTrainingLoadDailyTable,
} from '@features/analytics/api/analyticsDomain'

jest.mock('@features/analytics/api/analyticsDomain', () => ({
    getAnalyticsMuscleLoadTable: jest.fn(),
    getAnalyticsTrainingLoadDailyTable: jest.fn(),
}))

const muscle = getAnalyticsMuscleLoadTable as jest.Mock
const daily = getAnalyticsTrainingLoadDailyTable as jest.Mock

function makeWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
}

const muscleRow = { date: '2026-01-05', muscleGroup: 'Грудь', loadScore: 12 }
const dailyRow = { date: '2026-01-05', fatigueScore: 8, volume: 1200, avgRpe: 7.5 }

describe('useMuscleLoadTable', () => {
    beforeEach(() => jest.clearAllMocks())

    it('запрашивает первую страницу с фильтрами и отдаёт строки', async () => {
        muscle.mockResolvedValue({ items: [muscleRow], total: 3 })

        const { result } = renderHook(
            () => useMuscleLoadTable({ dateFrom: '2026-01-01', dateTo: '2026-01-31', muscleGroup: 'Грудь' }),
            { wrapper: makeWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(muscle).toHaveBeenCalledWith({
            page: 1,
            page_size: 10,
            date_from: '2026-01-01',
            date_to: '2026-01-31',
            muscle_group: 'Грудь',
        })
        expect(result.current.items).toEqual([muscleRow])
        expect(result.current.total).toBe(3)
        expect(result.current.totalPages).toBe(1)
        expect(result.current.page).toBe(1)
    })

    it('не выпускает страницу за последнюю и не уходит ниже первой', async () => {
        muscle.mockResolvedValue({ items: [muscleRow], total: 25 })

        const { result } = renderHook(
            () => useMuscleLoadTable({ dateFrom: null, dateTo: null }),
            { wrapper: makeWrapper() },
        )
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.totalPages).toBe(3)

        // Каждый переход ждёт загрузку: в UI кнопки пагинации закрыты спиннером.
        act(() => result.current.goNext())
        await waitFor(() => expect(result.current.page).toBe(2))
        act(() => result.current.goNext())
        await waitFor(() => expect(result.current.page).toBe(3))
        expect(muscle).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }))

        // За последней страницей движения нет.
        act(() => result.current.goNext())
        await waitFor(() => expect(result.current.page).toBe(3))
        expect(muscle).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }))

        act(() => result.current.goPrev())
        await waitFor(() => expect(result.current.page).toBe(2))
        act(() => result.current.goPrev())
        await waitFor(() => expect(result.current.page).toBe(1))

        // И ниже первой тоже.
        act(() => result.current.goPrev())
        await waitFor(() => expect(result.current.page).toBe(1))
    })

    it('на пустом ответе отдаёт пустой список и одну страницу', async () => {
        muscle.mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMuscleLoadTable({ dateFrom: null, dateTo: null }),
            { wrapper: makeWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.items).toEqual([])
        expect(result.current.total).toBe(0)
        expect(result.current.totalPages).toBe(1)
    })

    it('пробрасывает ошибку запроса наружу', async () => {
        const failure = new Error('backend down')
        muscle.mockRejectedValue(failure)

        const { result } = renderHook(
            () => useMuscleLoadTable({ dateFrom: null, dateTo: null }),
            { wrapper: makeWrapper() },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBe(failure)
    })
})

describe('useTrainingLoadDailyTable', () => {
    beforeEach(() => jest.clearAllMocks())

    it('ходит в свой эндпоинт и не передаёт мышечную группу', async () => {
        daily.mockResolvedValue({ items: [dailyRow], total: 1 })

        const { result } = renderHook(
            () => useTrainingLoadDailyTable({ dateFrom: '2026-02-01', dateTo: '2026-02-28', pageSize: 25 }),
            { wrapper: makeWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(daily).toHaveBeenCalledWith({
            page: 1,
            page_size: 25,
            date_from: '2026-02-01',
            date_to: '2026-02-28',
        })
        expect(muscle).not.toHaveBeenCalled()
        expect(result.current.items).toEqual([dailyRow])
        expect(result.current.totalPages).toBe(1)
    })
})
