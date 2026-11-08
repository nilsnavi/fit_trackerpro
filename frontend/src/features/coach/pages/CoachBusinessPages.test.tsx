import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CoachPackagesPage } from './CoachPackagesPage'
import { CoachClientPackagesPage } from './CoachClientPackagesPage'
import { CoachTasksPage } from './CoachTasksPage'
import { coachApi } from '../api/coachApi'

jest.mock('../api/coachApi', () => ({ coachApi: {
    listPackages: jest.fn(), createPackage: jest.fn(), archivePackage: jest.fn(),
    listClientPackages: jest.fn(), assignClientPackage: jest.fn(), consumeClientPackage: jest.fn(),
    reverseClientPackage: jest.fn(), listClientPayments: jest.fn(), recordClientPayment: jest.fn(),
    listTasks: jest.fn(), createTask: jest.fn(), completeTask: jest.fn(),
} }))

function renderPage(element: React.ReactNode, route = '/', path = '*') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[route]}>
                <Routes><Route path={path} element={element} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Coach business pages (Sprint 10.4)', () => {
    it('shows package loading, empty and error states', async () => {
        jest.mocked(coachApi.listPackages).mockRejectedValueOnce(new Error('offline'))
        renderPage(<CoachPackagesPage />)
        expect(await screen.findByText('Не удалось загрузить пакеты')).toBeInTheDocument()

        jest.mocked(coachApi.listPackages).mockResolvedValueOnce([] as never)
        renderPage(<CoachPackagesPage />)
        expect(await screen.findByText('Пока нет пакетов')).toBeInTheDocument()
    })

    it('creates a package template with validated form', async () => {
        jest.mocked(coachApi.listPackages).mockResolvedValue([
            { id: 3, coach_id: 1, name: 'Pack A', description: null, sessions_total: 5, validity_days: 30, price_amount: '5000.00', currency: 'RUB', status: 'ACTIVE', archived_at: null, created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z' },
        ] as never)
        jest.mocked(coachApi.createPackage).mockResolvedValue({ id: 4 } as never)
        renderPage(<CoachPackagesPage />)

        expect(await screen.findByText('Pack A')).toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText('Название'), { target: { value: 'Pack B' } })
        fireEvent.click(screen.getByRole('button', { name: /Создать пакет/ }))
        await waitFor(() => expect(coachApi.createPackage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pack B', sessions_total: 5 })))

        fireEvent.change(screen.getByPlaceholderText('Название'), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: /Создать пакет/ }))
        expect(await screen.findByText('Укажите название и число тренировок (минимум 1)')).toBeInTheDocument()
        expect(coachApi.createPackage).toHaveBeenCalledTimes(1)
    })

    it('consumes and reverses a client package session', async () => {
        jest.mocked(coachApi.listClientPackages).mockResolvedValue([
            { id: 7, coach_id: 1, client_id: 22, relationship_id: 5, package_id: 3, name: 'Pack A', sessions_total: 5, sessions_used: 1, sessions_remaining: 4, price_amount: null, currency: 'RUB', purchased_at: '2026-11-06T00:00:00Z', expires_at: '2026-12-06', auto_consume: false, status: 'ACTIVE', cancelled_at: null, created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z' },
        ] as never)
        jest.mocked(coachApi.listClientPayments).mockResolvedValue([] as never)
        jest.mocked(coachApi.consumeClientPackage).mockResolvedValue({ id: 7, sessions_used: 2 } as never)
        jest.mocked(coachApi.reverseClientPackage).mockResolvedValue({ id: 7, sessions_used: 0 } as never)
        renderPage(<CoachClientPackagesPage />, '/coach/clients/22/packages', '/coach/clients/:clientId/packages')

        const card = await screen.findByTestId('client-package-card')
        expect(card).toHaveTextContent('Pack A')
        fireEvent.click(screen.getByRole('button', { name: /Списать/ }))
        await waitFor(() => expect(coachApi.consumeClientPackage).toHaveBeenCalledWith(22, 7, expect.any(String)))
        fireEvent.click(screen.getByRole('button', { name: /Вернуть/ }))
        await waitFor(() => expect(coachApi.reverseClientPackage).toHaveBeenCalledWith(22, 7))
    })

    it('validates payment amount before recording', async () => {
        jest.mocked(coachApi.listClientPackages).mockResolvedValue([] as never)
        jest.mocked(coachApi.listClientPayments).mockResolvedValue([] as never)
        renderPage(<CoachClientPackagesPage />, '/coach/clients/22/packages', '/coach/clients/:clientId/packages')

        fireEvent.change(screen.getByPlaceholderText('Сумма'), { target: { value: 'abc' } })
        fireEvent.click(screen.getByRole('button', { name: /Записать оплату/ }))
        expect(await screen.findByText('Сумма должна быть больше нуля')).toBeInTheDocument()
        expect(coachApi.recordClientPayment).not.toHaveBeenCalled()

        fireEvent.change(screen.getByPlaceholderText('Сумма'), { target: { value: '5000' } })
        jest.mocked(coachApi.recordClientPayment).mockResolvedValue({ id: 9 } as never)
        fireEvent.click(screen.getByRole('button', { name: /Записать оплату/ }))
        await waitFor(() => expect(coachApi.recordClientPayment).toHaveBeenCalledWith(22, expect.objectContaining({ amount: 5000, currency: 'RUB' })))
    })

    it('lists, completes and filters tasks', async () => {
        jest.mocked(coachApi.listTasks).mockResolvedValue([
            { id: 4, coach_id: 1, client_id: null, title: 'Составить план', description: null, priority: 'NORMAL', due_at: null, source: 'MANUAL', completed_at: null, created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z' },
        ] as never)
        jest.mocked(coachApi.completeTask).mockResolvedValue({ id: 4, completed_at: '2026-11-06T10:00:00Z' } as never)
        renderPage(<CoachTasksPage />)

        expect(await screen.findByText('Составить план')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Выполнить' }))
        await waitFor(() => expect(coachApi.completeTask).toHaveBeenCalledWith(4))

        fireEvent.click(screen.getByRole('button', { name: 'Выполненные' }))
        await waitFor(() => expect(coachApi.listTasks).toHaveBeenCalledWith({ completed: true }))
        fireEvent.click(screen.getByRole('button', { name: 'Активные' }))
        await waitFor(() => expect(coachApi.listTasks).toHaveBeenCalledWith({ completed: false }))
    })

    it('blocks empty task creation with a validation message', async () => {
        jest.mocked(coachApi.listTasks).mockResolvedValue([] as never)
        jest.mocked(coachApi.createTask).mockResolvedValue({ id: 5 } as never)
        renderPage(<CoachTasksPage />)

        fireEvent.click(screen.getByRole('button', { name: /Создать задачу/ }))
        expect(await screen.findByText('Укажите название задачи')).toBeInTheDocument()
        expect(coachApi.createTask).not.toHaveBeenCalled()

        fireEvent.change(screen.getByPlaceholderText('Название задачи'), { target: { value: 'Позвонить' } })
        fireEvent.click(screen.getByRole('button', { name: /Создать задачу/ }))
        await waitFor(() => expect(coachApi.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Позвонить', priority: 'NORMAL' })))
    })
})
