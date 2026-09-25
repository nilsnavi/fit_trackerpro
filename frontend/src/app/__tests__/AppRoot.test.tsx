import { act, render, screen } from '@testing-library/react'
import { useAppTerminationStore } from '@/stores/appTerminationStore'
import { wipeLocalUserData } from '@shared/lib/wipeLocalUserData'
import { AppRoot } from '../AppRoot'

jest.mock('../../App', () => ({
    __esModule: true,
    default: () => <div>Приложение</div>,
}))

jest.mock('@/components/TelegramAuthGate', () => ({
    TelegramAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@shared/lib/wipeLocalUserData', () => ({
    wipeLocalUserData: jest.fn(),
}))

const wipe = wipeLocalUserData as jest.Mock

describe('AppRoot', () => {
    beforeEach(() => {
        wipe.mockReset()
        wipe.mockResolvedValue({
            syncQueue: true,
            localStorage: true,
            sessionStorage: true,
            indexedDb: true,
            telegramCloudStorage: null,
        })
        useAppTerminationStore.setState({ reason: null })
    })

    it('renders the app normally', () => {
        render(<AppRoot />)
        expect(screen.getByText('Приложение')).toBeInTheDocument()
    })

    it('unmounts the whole app after account deletion and only then wipes device data', async () => {
        render(<AppRoot />)

        act(() => useAppTerminationStore.getState().terminate('account_deleted'))

        expect(screen.queryByText('Приложение')).toBeNull()
        expect(screen.getByText('Аккаунт удалён')).toBeInTheDocument()
        expect(await screen.findByText('Данные на этом устройстве тоже удалены.')).toBeInTheDocument()
        expect(wipe).toHaveBeenCalledTimes(1)
    })

    it('tells the user when part of the device data could not be removed', async () => {
        wipe.mockResolvedValue({
            syncQueue: true,
            localStorage: true,
            sessionStorage: true,
            indexedDb: false,
            telegramCloudStorage: null,
        })
        useAppTerminationStore.setState({ reason: 'account_deleted' })

        render(<AppRoot />)

        expect(await screen.findByText(/Часть данных на устройстве удалить не удалось/)).toBeInTheDocument()
    })

    it('offers to close the Mini App inside Telegram', async () => {
        const close = jest.fn()
        ;(window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'query_id=1', close } }
        useAppTerminationStore.setState({ reason: 'account_deleted' })
        try {
            render(<AppRoot />)
            const button = await screen.findByRole('button', { name: 'Закрыть приложение' })
            await screen.findByText('Данные на этом устройстве тоже удалены.')
            act(() => button.click())
            expect(close).toHaveBeenCalledTimes(1)
        } finally {
            delete (window as { Telegram?: unknown }).Telegram
        }
    })
})
