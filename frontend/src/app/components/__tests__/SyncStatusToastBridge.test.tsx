import { render } from '@testing-library/react'
import { SyncStatusToastBridge } from '../SyncStatusToastBridge'

jest.mock('@shared/hooks/useNetworkOnline', () => ({ useNetworkOnline: jest.fn() }))
jest.mock('@shared/hooks/useSyncQueue', () => ({ useSyncQueue: jest.fn() }))
jest.mock('@shared/stores/toastStore', () => ({ toast: { syncStatus: jest.fn() } }))

const { useNetworkOnline } = jest.requireMock('@shared/hooks/useNetworkOnline') as { useNetworkOnline: jest.Mock }
const { useSyncQueue } = jest.requireMock('@shared/hooks/useSyncQueue') as { useSyncQueue: jest.Mock }
const { toast } = jest.requireMock('@shared/stores/toastStore') as { toast: { syncStatus: jest.Mock } }

interface SliceOverrides {
    online?: boolean
    totalCount?: number
    failedCount?: number
    isFlushing?: boolean
    retryInSec?: number
    retryAllFailed?: jest.Mock
}

function setUp({
    online = true,
    totalCount = 0,
    failedCount = 0,
    isFlushing = false,
    retryInSec = 0,
    retryAllFailed = jest.fn(),
}: SliceOverrides = {}) {
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
        retryAllFailed,
    })
    return { retryAllFailed }
}

function lastSyncCall() {
    const calls = toast.syncStatus.mock.calls
    return calls[calls.length - 1]
}

describe('SyncStatusToastBridge', () => {
    beforeEach(() => {
        toast.syncStatus.mockClear()
    })

    it('сообщает об офлайне с числом сохранённых локально операций', () => {
        setUp({ online: false, totalCount: 2 })

        render(<SyncStatusToastBridge />)

        expect(toast.syncStatus).toHaveBeenCalledWith('offline', { queuedCount: 2 })
    })

    it('показывает синхронизацию во время отправки', () => {
        setUp({ totalCount: 1, isFlushing: true })

        render(<SyncStatusToastBridge />)

        expect(lastSyncCall()).toEqual(['syncing', { queuedCount: 1 }])
    })

    it('ждёт отправки с обратным отсчётом', () => {
        setUp({ totalCount: 3, retryInSec: 5 })

        render(<SyncStatusToastBridge />)

        expect(lastSyncCall()).toEqual(['queued', { queuedCount: 3, retryInSec: 5 }])
    })

    it('не рапортует о синхронизированном состоянии из пустоты', () => {
        setUp()

        render(<SyncStatusToastBridge />)

        expect(toast.syncStatus).not.toHaveBeenCalled()
    })

    it('переходит в synced после непустого состояния', () => {
        setUp({ totalCount: 1 })
        const { rerender } = render(<SyncStatusToastBridge />)

        setUp()
        rerender(<SyncStatusToastBridge />)

        expect(lastSyncCall()).toEqual(['synced'])
    })

    it('«Повторить сейчас» идёт в действие читающей поверхности, а не в движок', () => {
        const { retryAllFailed } = setUp({ failedCount: 1 })
        render(<SyncStatusToastBridge />)

        const [kind, options] = lastSyncCall() as [string, { failedCount: number; onRetryNow: () => void }]
        expect(kind).toBe('failed')
        expect(options.failedCount).toBe(1)

        options.onRetryNow()

        expect(retryAllFailed).toHaveBeenCalledTimes(1)
    })
})
