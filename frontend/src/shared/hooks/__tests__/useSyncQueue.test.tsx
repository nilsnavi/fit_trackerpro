import { renderHook, act } from '@testing-library/react'
import { AppHttpError } from '@shared/errors'
import { SyncQueueEngine, resetSyncQueueEngineForTests } from '@shared/offline/syncQueue'
import { useSyncQueue } from '../useSyncQueue'

const WORKOUT_ID = 7
const OTHER_WORKOUT_ID = 8

function memoryStorage(): Storage {
    const m = new Map<string, string>()
    return {
        get length() {
            return m.size
        },
        clear: () => m.clear(),
        getItem: (k: string) => m.get(k) ?? null,
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        removeItem: (k: string) => {
            m.delete(k)
        },
        setItem: (k: string, v: string) => {
            m.set(k, v)
        },
    }
}

function makeEngine(executeOp = jest.fn().mockResolvedValue(undefined)): SyncQueueEngine {
    return new SyncQueueEngine({
        storageKey: 'test_hooks_queue',
        getStorage: () => memoryStorage(),
        executeOp,
    })
}

function enqueue(engine: SyncQueueEngine, workoutId: number): void {
    engine.enqueue({
        kind: 'workout.session.update',
        dedupeKey: `workout:session:${workoutId}`,
        payload: { workoutId },
    })
}

function workoutIdOf(item: { payload: unknown }): unknown {
    return (item.payload as { workoutId?: number } | undefined)?.workoutId
}

describe('useSyncQueue — читающая поверхность очереди', () => {
    let engine: SyncQueueEngine

    beforeEach(() => {
        engine = makeEngine()
        resetSyncQueueEngineForTests(engine)
    })

    afterEach(() => {
        resetSyncQueueEngineForTests(null)
    })

    it('подписывается на движок один раз', () => {
        const subscribe = jest.spyOn(engine, 'subscribe')

        renderHook(() => useSyncQueue({ workoutId: WORKOUT_ID }))

        expect(subscribe).toHaveBeenCalledTimes(1)
    })

    it('срез по тренировке отдаёт только её элементы и её счётчики', () => {
        enqueue(engine, WORKOUT_ID)
        enqueue(engine, OTHER_WORKOUT_ID)

        const { result } = renderHook(() => useSyncQueue({ workoutId: WORKOUT_ID }))

        expect(result.current.totalCount).toBe(1)
        expect(result.current.pendingItems).toHaveLength(1)
        expect(result.current.items.map(workoutIdOf)).toEqual([WORKOUT_ID])
    })

    it('без аргументов отдаёт всю очередь', () => {
        enqueue(engine, WORKOUT_ID)
        enqueue(engine, OTHER_WORKOUT_ID)

        const { result } = renderHook(() => useSyncQueue())

        expect(result.current.totalCount).toBe(2)
        expect(result.current.pendingItems).toHaveLength(2)
    })

    it('реагирует на изменения очереди', () => {
        const { result } = renderHook(() => useSyncQueue({ workoutId: WORKOUT_ID }))
        expect(result.current.totalCount).toBe(0)

        act(() => {
            enqueue(engine, WORKOUT_ID)
        })

        expect(result.current.totalCount).toBe(1)
        expect(result.current.items.map(workoutIdOf)).toEqual([WORKOUT_ID])
    })

    it('повтор упавших не трогает чужую тренировку и подталкивает отправку', async () => {
        const failing = makeEngine(jest.fn().mockRejectedValue(new Error('boom')))
        resetSyncQueueEngineForTests(failing)
        enqueue(failing, WORKOUT_ID)
        enqueue(failing, OTHER_WORKOUT_ID)
        await failing.flush()

        const retryItem = jest.spyOn(failing, 'retryItem')
        const flush = jest.spyOn(failing, 'flush')
        const { result } = renderHook(() => useSyncQueue({ workoutId: WORKOUT_ID }))
        expect(result.current.failedCount).toBe(1)

        await act(async () => {
            await result.current.retryAllFailed()
        })

        expect(retryItem).toHaveBeenCalledTimes(1)
        expect(retryItem).toHaveBeenCalledWith(result.current.items[0].id)
        expect(flush).toHaveBeenCalled()
    })

    it('отдаёт остаток backoff, пока элементы ждут повтора', async () => {
        const failing = makeEngine(
            jest.fn().mockRejectedValue(new AppHttpError({ status: 503, code: 'unavailable', message: 'later' })),
        )
        resetSyncQueueEngineForTests(failing)
        enqueue(failing, WORKOUT_ID)
        await failing.flush()

        const { result } = renderHook(() => useSyncQueue({ workoutId: WORKOUT_ID }))

        expect(result.current.retryInSec).toBeGreaterThan(0)
    })
})
