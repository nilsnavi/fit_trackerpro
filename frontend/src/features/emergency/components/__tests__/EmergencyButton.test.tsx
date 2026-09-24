/**
 * EmergencyButton (WS1-13): интерфейс не должен утверждать, что уведомление
 * отправлено, если ничего не доставлено. Тесты фиксируют честные состояния.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { EmergencyButton } from '../EmergencyButton'
import * as emergencyHooks from '@features/emergency/hooks/useEmergencyQueries'

jest.mock('@features/emergency/hooks/useEmergencyQueries', () => ({
    useEmergencyContactsQuery: jest.fn(),
    useEmergencyNotifyMutation: jest.fn(),
}))

const mockContactsQuery = emergencyHooks.useEmergencyContactsQuery as jest.Mock
const mockNotifyMutation = emergencyHooks.useEmergencyNotifyMutation as jest.Mock

function contact(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        user_id: 5,
        contact_name: 'Мама',
        contact_username: 'mama',
        phone: null,
        relationship_type: null,
        is_active: true,
        notify_on_emergency: true,
        notify_on_workout_start: false,
        notify_on_workout_end: false,
        priority: 1,
        is_linked: false,
        linked_at: null,
        ...overrides,
    }
}

function renderButton() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <EmergencyButton />
        </QueryClientProvider>,
    )
}

function setupMutation(result: unknown) {
    const mutateAsync = jest.fn().mockResolvedValue(result)
    mockNotifyMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
        isError: false,
        error: null,
        reset: jest.fn(),
    })
    return mutateAsync
}

describe('EmergencyButton', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockContactsQuery.mockReturnValue({
            data: { items: [contact()], total: 1, active_count: 1 },
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
        })
    })

    it('says outright that no contact is reachable yet', () => {
        renderButton()

        expect(
            screen.getByText('Ни один контакт ещё не подключён к боту — уведомление не дойдёт.'),
        ).toBeInTheDocument()
    })

    it('does not pretend to call an ambulance in the confirmation dialog', () => {
        setupMutation({ successful_count: 1, failed_count: 0, results: [] })
        renderButton()

        fireEvent.click(screen.getByTestId('emergency-button'))

        expect(screen.getByText(/Приложение не вызывает скорую помощь/)).toBeInTheDocument()
        expect(screen.getByText(/Местоположение не передаётся автоматически/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Позвонить 112/ })).toHaveAttribute('href', 'tel:112')
    })

    it('reports delivery per contact and names who was not reached', async () => {
        const mutateAsync = setupMutation({
            successful_count: 1,
            failed_count: 1,
            results: [
                { contact_id: 1, contact_name: 'Мама', method: 'telegram', success: true, error: null },
                {
                    contact_id: 2,
                    contact_name: 'Брат',
                    method: 'unlinked',
                    success: false,
                    error: 'Контакт не подключён к боту',
                },
            ],
        })
        renderButton()

        fireEvent.click(screen.getByTestId('emergency-button'))
        fireEvent.click(screen.getByTestId('emergency-confirm'))

        await waitFor(() => {
            expect(screen.getByText(/Уведомление отправлено/)).toHaveTextContent('Мама')
        })
        expect(mutateAsync).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Не доставлено (1)')).toBeInTheDocument()
        expect(screen.getByText(/Брат: Контакт не подключён к боту/)).toBeInTheDocument()
    })

    it('never claims success when nothing was delivered', async () => {
        setupMutation({
            successful_count: 0,
            failed_count: 1,
            results: [
                {
                    contact_id: 1,
                    contact_name: 'Мама',
                    method: 'unlinked',
                    success: false,
                    error: 'Контакт не подключён к боту',
                },
            ],
        })
        renderButton()

        fireEvent.click(screen.getByTestId('emergency-button'))
        fireEvent.click(screen.getByTestId('emergency-confirm'))

        await waitFor(() => {
            expect(screen.getByTestId('emergency-not-delivered')).toBeInTheDocument()
        })
        expect(screen.queryByText(/Уведомление отправлено/)).not.toBeInTheDocument()
    })

    it('tells the user to add contacts when there are none', () => {
        mockContactsQuery.mockReturnValue({
            data: { items: [], total: 0, active_count: 0 },
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
        })

        renderButton()

        expect(
            screen.getByText('Экстренные контакты не настроены — добавьте близких в профиле.'),
        ).toBeInTheDocument()
    })
})
