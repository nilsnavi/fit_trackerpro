/**
 * EmergencyContactsSection (WS1-13): статус контакта и приглашение в бот.
 * Реальная доставка возможна только после подключения контакта, и интерфейс
 * должен это показывать.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { EmergencyContactsSection } from '../EmergencyContactsSection'
import * as emergencyHooks from '@features/emergency/hooks/useEmergencyQueries'

jest.mock('@features/emergency/hooks/useEmergencyQueries', () => ({
    useEmergencyContactsQuery: jest.fn(),
    useCreateEmergencyContactMutation: jest.fn(),
    useDeleteEmergencyContactMutation: jest.fn(),
    useIssueEmergencyLinkCodeMutation: jest.fn(),
    useUnlinkEmergencyContactMutation: jest.fn(),
    useUpdateEmergencyContactMutation: jest.fn(),
}))

const mockContactsQuery = emergencyHooks.useEmergencyContactsQuery as jest.Mock
const mockCreate = emergencyHooks.useCreateEmergencyContactMutation as jest.Mock
const mockDelete = emergencyHooks.useDeleteEmergencyContactMutation as jest.Mock
const mockLinkCode = emergencyHooks.useIssueEmergencyLinkCodeMutation as jest.Mock
const mockUnlink = emergencyHooks.useUnlinkEmergencyContactMutation as jest.Mock
const mockUpdate = emergencyHooks.useUpdateEmergencyContactMutation as jest.Mock

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

function idleMutation(overrides: Record<string, unknown> = {}) {
    return {
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isPending: false,
        isError: false,
        error: null,
        reset: jest.fn(),
        ...overrides,
    }
}

function renderSection() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <EmergencyContactsSection />
        </QueryClientProvider>,
    )
}

describe('EmergencyContactsSection', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockContactsQuery.mockReturnValue({
            data: { items: [contact()], total: 1, active_count: 1 },
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
        })
        mockCreate.mockReturnValue(idleMutation())
        mockDelete.mockReturnValue(idleMutation())
        mockLinkCode.mockReturnValue(idleMutation())
        mockUnlink.mockReturnValue(idleMutation())
        mockUpdate.mockReturnValue(idleMutation())
    })

    it('shows the real linking status of each contact', () => {
        mockContactsQuery.mockReturnValue({
            data: {
                items: [
                    contact({ id: 1, contact_name: 'Мама', is_linked: true }),
                    contact({ id: 2, contact_name: 'Брат', contact_username: 'brat' }),
                ],
                total: 2,
                active_count: 2,
            },
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
        })

        renderSection()

        expect(screen.getByTestId('contact-status-1')).toHaveTextContent('подключён')
        expect(screen.getByTestId('contact-status-2')).toHaveTextContent('не подключён')
    })

    it('hands out an invite code for a contact to start the bot', async () => {
        mockLinkCode.mockReturnValue(
            idleMutation({
                mutateAsync: jest.fn().mockResolvedValue({
                    contact_id: 1,
                    contact_name: 'Мама',
                    code: 'ab23cd45ef',
                    command: '/link ab23cd45ef',
                    deep_link: 'https://t.me/fittracker_pro_bot?start=link_ab23cd45ef',
                    is_linked: false,
                }),
            }),
        )

        renderSection()
        fireEvent.click(screen.getByRole('button', { name: 'Пригласить в бот' }))

        await waitFor(() => {
            expect(screen.getByText('ab23cd45ef')).toBeInTheDocument()
        })
        expect(screen.getByText('/link ab23cd45ef')).toBeInTheDocument()
        expect(screen.getByText('Открыть чат с ботом')).toBeInTheDocument()
    })

    it('sends the new contact without the @ sign and requires a channel', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined)
        mockCreate.mockReturnValue(idleMutation({ mutateAsync }))

        renderSection()
        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))

        fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Папа' } })
        const save = screen.getByRole('button', { name: 'Сохранить' })
        expect(save).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Telegram username'), { target: { value: '@papa' } })
        fireEvent.click(save)

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({
                contact_name: 'Папа',
                contact_username: 'papa',
                phone: undefined,
                notify_on_emergency: true,
                notify_on_workout_start: false,
                notify_on_workout_end: false,
            })
        })
    })

    it('lets the user opt a new contact into workout start/end messages', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined)
        mockCreate.mockReturnValue(idleMutation({ mutateAsync }))

        renderSection()
        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
        fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Папа' } })
        fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+79990001122' } })
        fireEvent.click(screen.getByLabelText(/Начало тренировки/))
        fireEvent.click(screen.getByLabelText(/Окончание тренировки/))
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone: '+79990001122',
                    notify_on_workout_start: true,
                    notify_on_workout_end: true,
                }),
            )
        })
    })

    it('keeps the form and shows the server message on a duplicate (409)', async () => {
        const conflict = Object.assign(new Error('conflict'), {
            isAxiosError: true,
            response: {
                status: 409,
                data: {
                    error: {
                        code: 'emergency_contact_conflict',
                        message: 'Контакт с таким Telegram username или телефоном уже есть',
                    },
                },
            },
        })
        mockCreate.mockReturnValue(idleMutation({ mutateAsync: jest.fn().mockRejectedValue(conflict) }))

        renderSection()
        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
        fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Мама 2' } })
        fireEvent.change(screen.getByLabelText('Telegram username'), { target: { value: 'mama' } })
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('уже есть')
        // Введённые данные не потерялись — можно исправить и отправить снова.
        expect(screen.getByLabelText('Telegram username')).toHaveValue('mama')
    })

    it('shows what each contact is subscribed to', () => {
        mockContactsQuery.mockReturnValue({
            data: {
                items: [
                    contact({ id: 1, notify_on_workout_start: true, notify_on_workout_end: true }),
                    contact({ id: 2, contact_username: 'brat', is_active: false }),
                ],
                total: 2,
                active_count: 1,
            },
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null,
        })

        renderSection()

        expect(screen.getByTestId('contact-subscriptions-1')).toHaveTextContent(
            'Уведомляем: «Мне плохо», начало, окончание',
        )
        expect(screen.getByTestId('contact-subscriptions-2')).toHaveTextContent('неактивен')
    })

    it('edits a contact and sends only the changed fields', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined)
        mockUpdate.mockReturnValue(idleMutation({ mutateAsync }))

        renderSection()
        fireEvent.click(screen.getByRole('button', { name: 'Изменить контакт Мама' }))

        expect(screen.getByLabelText('Имя')).toHaveValue('Мама')
        fireEvent.click(screen.getByLabelText(/Окончание тренировки/))
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({
                contactId: 1,
                payload: { notify_on_workout_end: true },
            })
        })
    })
})
