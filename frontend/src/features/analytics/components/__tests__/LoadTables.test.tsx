import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MuscleLoadTable } from '../MuscleLoadTable'
import { TrainingLoadTable } from '../TrainingLoadTable'
import {
    getAnalyticsMuscleLoadTable,
    getAnalyticsTrainingLoadDailyTable,
} from '@features/analytics/api/analyticsDomain'

jest.mock('@features/analytics/api/analyticsDomain', () => ({
    getAnalyticsMuscleLoadTable: jest.fn(),
    getAnalyticsTrainingLoadDailyTable: jest.fn(),
}))

jest.mock('@shared/hooks/useTelegramWebApp', () => ({
    useTelegramWebApp: () => ({ hapticFeedback: jest.fn() }),
}))

const muscle = getAnalyticsMuscleLoadTable as jest.Mock
const daily = getAnalyticsTrainingLoadDailyTable as jest.Mock

function createWrapper() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

describe('MuscleLoadTable', () => {
    beforeEach(() => jest.clearAllMocks())

    it('рисует строки из владельца запроса', async () => {
        muscle.mockResolvedValue({
            items: [{ date: '2026-01-05', muscleGroup: 'Грудь', loadScore: 12 }],
            total: 1,
        })

        render(<MuscleLoadTable dateFrom="2026-01-01" dateTo="2026-01-31" />, { wrapper: createWrapper() })

        await waitFor(() => expect(screen.getAllByText('Грудь').length).toBeGreaterThan(0))
        expect(screen.getAllByText('12').length).toBeGreaterThan(0)
        expect(screen.getByText(/Всего записей: 1/)).toBeInTheDocument()
    })

    it('показывает пустое состояние без данных', async () => {
        muscle.mockResolvedValue({ items: [], total: 0 })

        render(<MuscleLoadTable dateFrom={null} dateTo={null} />, { wrapper: createWrapper() })

        expect(
            await screen.findByText('Нет данных о мышечной нагрузке за выбранный период'),
        ).toBeInTheDocument()
    })

    it('показывает ошибку запроса', async () => {
        muscle.mockRejectedValue(new Error('backend down'))

        render(<MuscleLoadTable dateFrom={null} dateTo={null} />, { wrapper: createWrapper() })

        expect(await screen.findByText(/Ошибка загрузки/)).toBeInTheDocument()
    })

    it('переход по страницам запрашивает следующую страницу', async () => {
        muscle.mockResolvedValue({
            items: [{ date: '2026-01-05', muscleGroup: 'Грудь', loadScore: 12 }],
            total: 25,
        })

        render(<MuscleLoadTable dateFrom={null} dateTo={null} />, { wrapper: createWrapper() })

        expect(await screen.findByText('1 / 3')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Далее/ }))

        await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument())
        expect(muscle).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    })
})

describe('TrainingLoadTable', () => {
    beforeEach(() => jest.clearAllMocks())

    it('рисует объём и RPE из своего запроса', async () => {
        daily.mockResolvedValue({
            items: [{ date: '2026-02-10', fatigueScore: 8, volume: 1200, avgRpe: 7.5 }],
            total: 1,
        })

        render(<TrainingLoadTable dateFrom={null} dateTo={null} />, { wrapper: createWrapper() })

        await waitFor(() => expect(screen.getAllByText('1200').length).toBeGreaterThan(0))
        expect(screen.getAllByText('7.5').length).toBeGreaterThan(0)
        expect(muscle).not.toHaveBeenCalled()
    })

    it('показывает пустое состояние без данных', async () => {
        daily.mockResolvedValue({ items: [], total: 0 })

        render(<TrainingLoadTable dateFrom={null} dateTo={null} />, { wrapper: createWrapper() })

        expect(
            await screen.findByText('Нет данных о нагрузке за выбранный период'),
        ).toBeInTheDocument()
    })
})
