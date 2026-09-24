import { render, screen } from '@testing-library/react'
import { ConnectivitySyncBar } from '../ConnectivitySyncBar'

jest.mock('@shared/hooks/useNetworkOnline', () => ({ useNetworkOnline: jest.fn() }))
jest.mock('@shared/hooks/useSyncQueue', () => ({ useSyncQueue: jest.fn() }))

const { useNetworkOnline } = jest.requireMock('@shared/hooks/useNetworkOnline') as { useNetworkOnline: jest.Mock }
const { useSyncQueue } = jest.requireMock('@shared/hooks/useSyncQueue') as { useSyncQueue: jest.Mock }

function setUp({ online = true, totalCount = 0, failedCount = 0, isFlushing = false, retryInSec = 0 } = {}) {
    useNetworkOnline.mockReturnValue(online)
    useSyncQueue.mockReturnValue({
        items: [],
        failedItems: [],
        pendingItems: [],
        processingItems: [],
        totalCount,
        failedCount,
        isFlushing,
        retryInSec,
        retryItem: jest.fn(),
        retryAllFailed: jest.fn(),
    })
}

describe('ConnectivitySyncBar', () => {
    it('молчит, когда всё синхронизировано и сеть есть', () => {
        setUp()

        const { container } = render(<ConnectivitySyncBar />)

        expect(container).toBeEmptyDOMElement()
    })

    it('читает состояние из читающей поверхности очереди', () => {
        setUp({ totalCount: 2 })
        render(<ConnectivitySyncBar />)

        expect(useSyncQueue).toHaveBeenCalledWith()
        expect(screen.getByText('Изменения ждут отправки')).toBeInTheDocument()
        expect(screen.getByText('В очереди: 2 операции.')).toBeInTheDocument()
    })

    it('в офлайне сообщает, сколько изменений лежит локально', () => {
        setUp({ online: false, totalCount: 1 })
        render(<ConnectivitySyncBar />)

        expect(screen.getByText('Нет сети')).toBeInTheDocument()
        expect(screen.getByText(/В очереди на отправку: 1\./)).toBeInTheDocument()
    })

    it('во время отправки показывает прогресс', () => {
        setUp({ isFlushing: true, totalCount: 3 })
        render(<ConnectivitySyncBar />)

        expect(screen.getByText('Синхронизация с сервером…')).toBeInTheDocument()
        expect(screen.getByText(/осталось в очереди: 3/)).toBeInTheDocument()
    })

    it('показывает обратный отсчёт до повтора', () => {
        setUp({ totalCount: 2, retryInSec: 7 })
        render(<ConnectivitySyncBar />)

        expect(screen.getByText('Ожидание повтора отправки')).toBeInTheDocument()
        expect(screen.getByText(/Следующая попытка через 7 с/)).toBeInTheDocument()
    })

    it('требует внимания, когда элементы не удалось отправить', () => {
        setUp({ failedCount: 2 })
        render(<ConnectivitySyncBar />)

        expect(screen.getByText('Не удалось синхронизировать изменения')).toBeInTheDocument()
        expect(screen.getByText(/2 операции не отправлены/)).toBeInTheDocument()
    })
})
