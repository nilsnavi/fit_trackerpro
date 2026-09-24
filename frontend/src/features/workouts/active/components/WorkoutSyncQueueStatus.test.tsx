import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutSyncQueueStatus } from './WorkoutSyncQueueStatus'
import type { SyncQueueItem } from '@shared/offline/syncQueue'

jest.mock('@shared/hooks/useNetworkOnline', () => ({ useNetworkOnline: jest.fn() }))
jest.mock('@shared/hooks/useSyncQueue', () => ({ useSyncQueue: jest.fn() }))

const { useNetworkOnline } = jest.requireMock('@shared/hooks/useNetworkOnline') as { useNetworkOnline: jest.Mock }
const { useSyncQueue } = jest.requireMock('@shared/hooks/useSyncQueue') as { useSyncQueue: jest.Mock }

const WORKOUT_ID = 7

function makeItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
    return {
        id: 'item-1',
        kind: 'WORKOUT_SESSION_UPDATE',
        dedupeKey: 'workout:session:7',
        payload: { workoutId: WORKOUT_ID },
        createdAt: 1,
        attempts: 0,
        status: 'pending',
        nextRetryAt: 0,
        ...overrides,
    }
}

/**
 * Хук отдаёт срез очереди: компонент получает уже отфильтрованные элементы и их счётчики,
 * поэтому в тесте они и задаются готовыми.
 */
function setUp({ online = true, isFlushing = false, retryInSec = 0, items = [] as SyncQueueItem[] } = {}) {
    useNetworkOnline.mockReturnValue(online)

    const retryItem = jest.fn()
    const retryAllFailed = jest.fn()
    const failedItems = items.filter((item) => item.status === 'failed')
    useSyncQueue.mockReturnValue({
        items,
        failedItems,
        pendingItems: items.filter((item) => item.status === 'pending'),
        processingItems: items.filter((item) => item.status === 'processing'),
        totalCount: items.length,
        failedCount: failedItems.length,
        isFlushing,
        retryInSec,
        retryItem,
        retryAllFailed,
    })
    return { retryItem, retryAllFailed }
}

describe('WorkoutSyncQueueStatus', () => {
    it('читает очередь этой тренировки через читающую поверхность', () => {
        setUp()
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(useSyncQueue).toHaveBeenCalledWith({ workoutId: WORKOUT_ID })
    })

    it('показывает отсутствие сети раньше любого состояния очереди', () => {
        setUp({ online: false, items: [makeItem()] })
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(screen.getByText('Нет сети')).toBeInTheDocument()
    })

    it('показывает локально сохранённый подход, пока сеть его не приняла', () => {
        setUp({ items: [makeItem()] })
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(screen.getByText('Сохранено локально')).toBeInTheDocument()
        expect(screen.getByText('1 в очереди')).toBeInTheDocument()
    })

    it('не показывает чужую очередь: пустой срез — значит синхронизировано', () => {
        setUp()
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(screen.getByText('Синхронизировано')).toBeInTheDocument()
        expect(screen.queryByText(/в очереди/)).not.toBeInTheDocument()
    })

    it('повтор упавших элементов уходит в хук', () => {
        const { retryAllFailed } = setUp({ items: [makeItem({ status: 'failed', lastError: 'boom' })] })
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(screen.getByText('Ошибка синхронизации')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Повторить все (1)' }))

        expect(retryAllFailed).toHaveBeenCalledTimes(1)
    })

    it('показывает синхронизацию во время отправки', () => {
        setUp({ isFlushing: true, items: [makeItem({ status: 'processing' })] })
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(screen.getByText('Синхронизация...')).toBeInTheDocument()
        expect(screen.getByText('Синхронизация в процессе...')).toBeInTheDocument()
    })

    it('показывает ожидание повтора при backoff', () => {
        setUp({ items: [makeItem()], retryInSec: 5 })
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} />)

        expect(screen.getByText('Повтор через 5с')).toBeInTheDocument()
    })

    it('в развёрнутых деталях повторяет конкретный элемент', () => {
        const { retryItem } = setUp({ items: [makeItem({ status: 'failed', lastError: 'boom' })] })
        render(<WorkoutSyncQueueStatus workoutId={WORKOUT_ID} showDetails />)

        fireEvent.click(screen.getByText('Ошибка синхронизации'))
        expect(screen.getByText('Обновление подхода')).toBeInTheDocument()
        expect(screen.getByText('boom')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Повтор' }))
        expect(retryItem).toHaveBeenCalledWith('item-1')
    })
})
