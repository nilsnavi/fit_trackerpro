/**
 * Экран здоровья больше не показывает мок-метрик (WS2-1): только реальные блоки
 * (вода, глюкоза, самочувствие, замеры тела) и честные пустые состояния.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BodyMeasurement } from '@features/health/types/metrics'
import { useBodyMeasurementsQuery } from '@features/health/hooks/useHealthQueries'
import { HealthPage } from '../HealthPage'

jest.mock('@features/health/hooks/useHealthQueries', () => ({
    useBodyMeasurementsQuery: jest.fn(),
}))

jest.mock('@features/health/components/WaterTracker', () => ({
    WaterTracker: () => <div data-testid="water-block" />,
}))
jest.mock('@features/health/components/GlucoseTracker', () => ({
    GlucoseTracker: () => <div data-testid="glucose-block" />,
}))
jest.mock('@features/health/components/WellnessCheckin', () => ({
    WellnessCheckin: () => <div data-testid="wellness-block" />,
}))

const mockedMeasurements = useBodyMeasurementsQuery as jest.Mock

function renderPage() {
    return render(
        <MemoryRouter>
            <HealthPage />
        </MemoryRouter>,
    )
}

function queryResult(items: BodyMeasurement[]) {
    return {
        data: { items, total: items.length, page: 1, page_size: 50 },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }
}

describe('HealthPage', () => {
    beforeEach(() => jest.clearAllMocks())

    it('собирает экран из реальных блоков и не обещает метрик, которых нет в API', async () => {
        mockedMeasurements.mockReturnValue(queryResult([]))

        renderPage()

        expect(screen.getByTestId('health-water-section')).toBeInTheDocument()
        expect(screen.getByTestId('health-glucose-section')).toBeInTheDocument()
        expect(screen.getByTestId('health-wellness-section')).toBeInTheDocument()
        expect(screen.getByTestId('health-measurements-section')).toBeInTheDocument()

        // Трекеры подгружаются отдельными чанками — дожидаемся Suspense.
        expect(await screen.findByTestId('water-block')).toBeInTheDocument()
        expect(await screen.findByTestId('glucose-block')).toBeInTheDocument()
        expect(await screen.findByTestId('wellness-block')).toBeInTheDocument()

        // Прошлый экран показывал выдуманные шаги, пульс и калории.
        expect(screen.queryByText('Шаги')).not.toBeInTheDocument()
        expect(screen.queryByText('Пульс')).not.toBeInTheDocument()
        expect(screen.queryByText('Калории')).not.toBeInTheDocument()
    })

    it('на пустом аккаунте показывает пустое состояние замеров, а не нули', () => {
        mockedMeasurements.mockReturnValue(queryResult([]))

        renderPage()

        expect(screen.getByTestId('body-measurements-empty')).toBeInTheDocument()
        expect(screen.queryByTestId('body-measurements-chart')).not.toBeInTheDocument()
    })

    it('показывает реальные значения замеров из API', () => {
        mockedMeasurements.mockReturnValue(
            queryResult([
                {
                    id: 1,
                    user_id: 1,
                    measurement_type: 'waist',
                    value_cm: 82,
                    measured_at: '2026-02-01T08:00:00Z',
                    created_at: '2026-02-01T08:00:00Z',
                    updated_at: '2026-02-01T08:00:00Z',
                },
                {
                    id: 2,
                    user_id: 1,
                    measurement_type: 'waist',
                    value_cm: 80.5,
                    measured_at: '2026-02-15T08:00:00Z',
                    created_at: '2026-02-15T08:00:00Z',
                    updated_at: '2026-02-15T08:00:00Z',
                },
            ]),
        )

        renderPage()

        expect(screen.getByTestId('measurement-waist')).toHaveTextContent('80.5')
        expect(screen.getByTestId('body-measurements-chart')).toBeInTheDocument()
    })
})
