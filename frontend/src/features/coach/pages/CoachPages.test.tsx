import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CoachOnboardingPage } from './CoachOnboardingPage'
import { CoachClientsPage } from './CoachClientsPage'
import { CoachInvitationAcceptPage } from './CoachInvitationAcceptPage'
import { CoachDashboardPage } from './CoachDashboardPage'
import { coachApi } from '../api/coachApi'
import { CoachMonitoringPage } from './CoachMonitoringPage'

jest.mock('../api/coachApi', () => ({ coachApi: {
    getProfile: jest.fn(), createProfile: jest.fn(), listClients: jest.fn(), resolveInvitation: jest.fn(), acceptInvitation: jest.fn(), getMonitoring: jest.fn(),
} }))

function renderPage(element: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}

describe('Coach pages', () => {
    it('provides a dashboard link to Coach Programs', async () => {
        jest.mocked(coachApi.getProfile).mockResolvedValue({
            id: 1, user_id: 10, display_name: 'Coach', bio: null, specializations: [],
        } as never)
        jest.mocked(coachApi.listClients).mockResolvedValue([] as never)
        renderPage(<CoachDashboardPage />)

        expect(await screen.findByRole('link', { name: 'Программы' })).toHaveAttribute('href', '/coach/programs')
        expect(screen.getByRole('link', { name: 'Мониторинг' })).toHaveAttribute('href', '/coach/monitoring')
    })

    it('renders monitoring counts, signal, attention filter and client navigation', async () => {
        jest.mocked(coachApi.getMonitoring).mockResolvedValue({ total: 2, attention_count: 1, ok_count: 1, items: [
            { client_id: 20, display_name: 'Client B', relationship_status: 'ACTIVE', active_assignment: null, last_completed_workout_at: null, days_since_last_workout: 8, active_workout: null, attention_status: 'ATTENTION', signals: [{ code: 'NO_RECENT_WORKOUT', severity: 'ATTENTION', title: 'Нет недавних тренировок', description: 'Нет завершённых тренировок 8 дней', occurred_at: '2026-09-01T00:00:00Z', source_type: 'workout_log', source_id: null, metadata: {} }], signal_count: 1, sort_priority: 200 },
            { client_id: 21, display_name: 'Client A', relationship_status: 'ACTIVE', active_assignment: null, last_completed_workout_at: '2026-09-28T00:00:00Z', days_since_last_workout: 1, active_workout: null, attention_status: 'OK', signals: [], signal_count: 0, sort_priority: 0 },
        ] } as never)
        renderPage(<CoachMonitoringPage />)
        expect(await screen.findByRole('heading', { name: 'Мониторинг клиентов' })).toBeInTheDocument()
        expect(screen.getByText('Client B')).toBeInTheDocument()
        expect(screen.getByText('Client A')).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'Открыть клиента' })[0]).toHaveAttribute('href', '/coach/monitoring/20')
        fireEvent.click(screen.getAllByRole('button', { name: 'Требуют внимания' })[0])
        await waitFor(() => expect(coachApi.getMonitoring).toHaveBeenCalledWith(expect.objectContaining({ status: 'attention' })))
    })

    it('validates and submits onboarding', async () => {
        jest.mocked(coachApi.createProfile).mockResolvedValue({ id: 1 } as never)
        renderPage(<CoachOnboardingPage />)
        expect(screen.getByLabelText('Имя тренера')).toBeRequired()
        fireEvent.change(screen.getByLabelText('Имя тренера'), { target: { value: 'Coach' } })
        fireEvent.click(screen.getByRole('button', { name: 'Создать профиль' }))
        await waitFor(() => expect(coachApi.createProfile).toHaveBeenCalledWith({ display_name: 'Coach', bio: null, specializations: [] }))
    })

    it('shows loading, empty and error client states', async () => {
        let finish!: (data: never[]) => void
        jest.mocked(coachApi.listClients).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }) as never)
        const loading = renderPage(<CoachClientsPage />)
        expect(screen.getByRole('status')).toBeInTheDocument()
        loading.unmount()

        jest.mocked(coachApi.listClients).mockResolvedValueOnce([] as never)
        renderPage(<CoachClientsPage />)
        expect(await screen.findByText('Пока нет клиентов')).toBeInTheDocument()
        finish?.([])

        jest.mocked(coachApi.listClients).mockRejectedValueOnce(new Error('offline'))
        renderPage(<CoachClientsPage />)
        expect(await screen.findByText('Не удалось загрузить клиентов')).toBeInTheDocument()
    })

    it('links current relationships but renders terminal relationships as history rows', async () => {
        const client = (client_id: number, status: string) => ({
            client_id,
            status,
            permissions: {},
            started_at: '2026-09-01T00:00:00Z',
            ended_at: status === 'ACTIVE' || status === 'PAUSED' ? null : '2026-09-10T00:00:00Z',
            archived_at: status === 'ARCHIVED' ? '2026-09-10T00:00:00Z' : null,
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-10T00:00:00Z',
        })
        jest.mocked(coachApi.listClients).mockResolvedValue([
            client(21, 'ACTIVE'),
            client(22, 'PAUSED'),
            client(23, 'ARCHIVED'),
            client(24, 'REVOKED'),
        ] as never)

        renderPage(<CoachClientsPage />)

        expect(await screen.findByRole('link', { name: /Клиент 21/ })).toHaveAttribute('href', '/coach/clients/21')
        expect(screen.getByRole('link', { name: /Клиент 22/ })).toHaveAttribute('href', '/coach/clients/22')
        expect(screen.queryByRole('link', { name: /Клиент 23/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /Клиент 24/ })).not.toBeInTheDocument()
        expect(screen.getByText('ARCHIVED')).toBeInTheDocument()
        expect(screen.getByText('REVOKED')).toBeInTheDocument()
    })

    it('removes invitation token from URL before resolve completes', async () => {
        window.history.replaceState({}, '', '/coach/invitations/accept?token=secret-token')
        jest.mocked(coachApi.resolveInvitation).mockResolvedValue({ coach: { display_name: 'Coach', specializations: [] } } as never)
        renderPage(<CoachInvitationAcceptPage />)
        await waitFor(() => expect(window.location.search).toBe(''))
        await waitFor(() => expect(coachApi.resolveInvitation).toHaveBeenCalledWith('secret-token'))
    })
})
