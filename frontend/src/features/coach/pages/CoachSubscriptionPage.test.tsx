import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { coachApi } from '../api/coachApi'
import { CoachSubscriptionPage } from './CoachSubscriptionPage'

jest.mock('../api/coachApi', () => ({ coachApi: { getSubscription: jest.fn(), listPlans: jest.fn() } }))

describe('CoachSubscriptionPage', () => {
    const plans = [
        { plan: 'FREE' as const, display_name: 'Бесплатный', limits: { active_clients: 3, active_programs: 2 }, available_features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: false } },
        { plan: 'TRAINER_PRO' as const, display_name: 'Trainer Pro', limits: { active_clients: null, active_programs: null }, available_features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: true } },
    ]

    it('shows current trial, live quota values, and no false purchase flow', async () => {
        jest.mocked(coachApi.getSubscription).mockResolvedValue({
            plan: 'TRAINER_PRO', status: 'TRIAL', trial_started_at: '2026-09-01T00:00:00Z', trial_ends_at: '2026-09-15T00:00:00Z', trial_days_remaining: 4,
            grace_ends_at: null, grace_days_remaining: null, period_started_at: null, period_ends_at: null, activated_at: null, cancelled_at: null, cancel_at_period_end: false,
            active_clients: { used: 5, limit: null, remaining: null }, active_programs: { used: 3, limit: null, remaining: null },
            features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: true }, upgrade_required: false,
        })
        jest.mocked(coachApi.listPlans).mockResolvedValue(plans)
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter><CoachSubscriptionPage /></MemoryRouter></QueryClientProvider>)

        expect(await screen.findByText('Пробный период Trainer Pro · 4 дн. осталось')).toBeInTheDocument()
        expect(screen.getByText(/5 · без ограничений/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Оплата скоро появится' })).not.toBeInTheDocument()
    })

    it('shows Free usage and the upgrade path without a payment control', async () => {
        jest.mocked(coachApi.getSubscription).mockResolvedValue({
            plan: 'FREE', status: 'ACTIVE', trial_started_at: null, trial_ends_at: null, trial_days_remaining: null,
            grace_ends_at: null, grace_days_remaining: null, period_started_at: null, period_ends_at: null, activated_at: null, cancelled_at: null,
            cancel_at_period_end: false, active_clients: { used: 3, limit: 3, remaining: 0 }, active_programs: { used: 2, limit: 2, remaining: 0 },
            features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: false }, upgrade_required: true,
        })
        jest.mocked(coachApi.listPlans).mockResolvedValue(plans)
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter><CoachSubscriptionPage /></MemoryRouter></QueryClientProvider>)

        expect(await screen.findByText('Клиенты: 3 из 3')).toBeInTheDocument()
        expect(screen.getByText('Программы: 2 из 2')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Оплата скоро появится' })).toBeDisabled()
    })

    it('shows the server supplied Pro grace state', async () => {
        jest.mocked(coachApi.getSubscription).mockResolvedValue({
            plan: 'TRAINER_PRO', status: 'GRACE', trial_started_at: '2026-09-01T00:00:00Z', trial_ends_at: '2026-09-15T00:00:00Z', trial_days_remaining: null,
            grace_ends_at: '2026-09-18T00:00:00Z', grace_days_remaining: 2, period_started_at: null, period_ends_at: null, activated_at: null, cancelled_at: null,
            cancel_at_period_end: false, active_clients: { used: 5, limit: null, remaining: null }, active_programs: { used: 3, limit: null, remaining: null },
            features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: true }, upgrade_required: false,
        })
        jest.mocked(coachApi.listPlans).mockResolvedValue(plans)
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><MemoryRouter><CoachSubscriptionPage /></MemoryRouter></QueryClientProvider>)

        expect(await screen.findByText('Переходный период Trainer Pro · 2 дн. осталось')).toBeInTheDocument()
        expect(screen.getByText((_content, element) => element?.textContent === 'Клиенты: 5 · без ограничений')).toBeInTheDocument()
    })

    it('renders loading and error states', async () => {
        jest.mocked(coachApi.getSubscription).mockImplementation(() => new Promise(() => undefined))
        jest.mocked(coachApi.listPlans).mockImplementation(() => new Promise(() => undefined))
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const view = render(<QueryClientProvider client={client}><MemoryRouter><CoachSubscriptionPage /></MemoryRouter></QueryClientProvider>)
        expect(await screen.findByRole('status')).toHaveTextContent('Загрузка тарифа')
        view.unmount()
        jest.mocked(coachApi.getSubscription).mockRejectedValue(new Error('offline'))
        jest.mocked(coachApi.listPlans).mockRejectedValue(new Error('offline'))
        const errorClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={errorClient}><MemoryRouter><CoachSubscriptionPage /></MemoryRouter></QueryClientProvider>)
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить информацию о тарифе')
    })
})
