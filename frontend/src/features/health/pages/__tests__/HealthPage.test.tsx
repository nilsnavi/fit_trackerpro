import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { HealthPage } from '../HealthPage'

jest.mock('@features/health/components/WaterTracker', () => ({
    WaterCompactWidget: ({ onClick }: { onClick?: () => void }) => (
        <button type="button" data-testid="water-card" onClick={onClick}>Вода</button>
    ),
}))
jest.mock('@features/health/components/GlucoseTracker', () => ({
    GlucoseCompactWidget: ({ onClick }: { onClick?: () => void }) => (
        <button type="button" data-testid="glucose-card" onClick={onClick}>Глюкоза</button>
    ),
}))
jest.mock('@features/health/components/WellnessCheckin', () => ({
    WellnessCompactWidget: ({ onClick }: { onClick?: () => void }) => (
        <button type="button" data-testid="wellness-card" onClick={onClick}>Самочувствие</button>
    ),
}))

function Location() {
    const location = useLocation()
    return <output data-testid="location">{location.pathname}</output>
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/health']}>
            <HealthPage />
            <Location />
        </MemoryRouter>,
    )
}

describe('HealthPage', () => {
    it('renders a compact daily dashboard with the four health entry points', async () => {
        renderPage()

        expect(screen.getByText('Сегодня')).toBeInTheDocument()
        expect(await screen.findByTestId('water-card')).toBeInTheDocument()
        expect(await screen.findByTestId('glucose-card')).toBeInTheDocument()
        expect(await screen.findByTestId('wellness-card')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /замеры тела/i })).toBeInTheDocument()
        expect(screen.queryByText('Статистика за неделю')).not.toBeInTheDocument()
    })

    it('navigates from each dashboard card to its focused health route', async () => {
        renderPage()

        fireEvent.click(await screen.findByTestId('water-card'))
        expect(screen.getByTestId('location')).toHaveTextContent('/health/water')

        fireEvent.click(screen.getByRole('button', { name: /замеры тела/i }))
        expect(screen.getByTestId('location')).toHaveTextContent('/health/measurements')
    })
})
