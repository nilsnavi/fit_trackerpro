import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usersApi } from '@shared/api/domains/usersApi'
import { AppHttpError } from '@shared/errors'
import { enqueueSyncMutation, resetSyncQueueEngineForTests } from '@shared/offline/syncQueue'
import { useAppTerminationStore } from '@/stores/appTerminationStore'
import { useAuthStore } from '@/stores/authStore'
import { DeleteAccountSection } from '../DeleteAccountSection'

jest.mock('@shared/api/domains/usersApi', () => ({
    usersApi: { deleteAccount: jest.fn() },
}))

jest.mock('@shared/hooks/useTelegramWebApp', () => ({
    useTelegramWebApp: () => ({ hapticFeedback: jest.fn() }),
}))

const deleteAccount = usersApi.deleteAccount as jest.Mock

function renderSection(queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })) {
    const onExportData = jest.fn()
    render(
        <QueryClientProvider client={queryClient}>
            <DeleteAccountSection onExportData={onExportData} isExporting={false} />
        </QueryClientProvider>,
    )
    return { onExportData, queryClient }
}

function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

async function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }))
    return screen.findByText('Удалить аккаунт?')
}

const confirmButton = () => screen.getByRole('button', { name: /Удалить навсегда/ })
const confirmInput = () => screen.getByLabelText(/введите УДАЛИТЬ/)

describe('DeleteAccountSection', () => {
    beforeEach(() => {
        deleteAccount.mockReset()
        setOnline(true)
        localStorage.clear()
        resetSyncQueueEngineForTests(null)
        useAppTerminationStore.setState({ reason: null })
        useAuthStore.getState().setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    })

    afterAll(() => setOnline(true))

    it('requires the typed confirmation word before deleting', async () => {
        renderSection()
        await openDialog()

        expect(confirmButton()).toBeDisabled()
        fireEvent.change(confirmInput(), { target: { value: 'удал' } })
        expect(confirmButton()).toBeDisabled()

        // Case-insensitive, surrounding spaces ignored.
        fireEvent.change(confirmInput(), { target: { value: '  удалить ' } })
        expect(confirmButton()).toBeEnabled()
        expect(deleteAccount).not.toHaveBeenCalled()
    })

    it('deletes the account, drops the session and switches the app to the terminal screen', async () => {
        deleteAccount.mockResolvedValue(undefined)
        const { queryClient } = renderSection()
        queryClient.setQueryData(['profile', 'me'], { id: 1 })
        await openDialog()

        fireEvent.change(confirmInput(), { target: { value: 'УДАЛИТЬ' } })
        fireEvent.click(confirmButton())

        await waitFor(() => expect(useAppTerminationStore.getState().reason).toBe('account_deleted'))
        expect(deleteAccount).toHaveBeenCalledTimes(1)
        expect(useAuthStore.getState().isAuthenticated).toBe(false)
        expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined()
    })

    it('keeps the session and shows the error when the server refuses', async () => {
        deleteAccount.mockRejectedValue(
            new AppHttpError({ status: 500, message: 'Внутренняя ошибка сервера', code: 'http_500' } as never),
        )
        renderSection()
        await openDialog()

        fireEvent.change(confirmInput(), { target: { value: 'УДАЛИТЬ' } })
        fireEvent.click(confirmButton())

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось удалить аккаунт')
        expect(useAppTerminationStore.getState().reason).toBeNull()
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it('cannot delete while offline', async () => {
        setOnline(false)
        renderSection()
        await openDialog()

        fireEvent.change(confirmInput(), { target: { value: 'УДАЛИТЬ' } })

        expect(confirmButton()).toBeDisabled()
        expect(screen.getByText(/Нужно подключение к интернету/)).toBeInTheDocument()
    })

    it('warns about unsynced changes and offers the export first', async () => {
        act(() => {
            enqueueSyncMutation({ kind: 'workout.set.patch', payload: { workoutId: 7 }, dedupeKey: 'a' })
            enqueueSyncMutation({ kind: 'workout.set.patch', payload: { workoutId: 7 }, dedupeKey: 'b' })
        })
        const { onExportData } = renderSection()
        await openDialog()

        expect(screen.getByTestId('delete-account-unsynced-warning')).toHaveTextContent(
            '2 изменения ещё не отправлены',
        )
        fireEvent.click(screen.getByRole('button', { name: /Сначала скачать мои данные/ }))
        expect(onExportData).toHaveBeenCalledTimes(1)
    })
})
