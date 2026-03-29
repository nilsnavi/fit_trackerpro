import { AppHttpError } from '@shared/errors'
import type { ClientError } from '@shared/errors'
import { SyncQueueEngine, resetSyncQueueEngineForTests } from '../engine'
import { WORKOUT_SYNC_KINDS } from '../workoutKinds'

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

function clientError(partial: Partial<ClientError>): ClientError {
    return {
        status: null,
        code: 'test',
        message: 'test',
        ...partial,
    }
}

describe('SyncQueueEngine', () => {
    beforeEach(() => {
        resetSyncQueueEngineForTests(null)
    })

    it('dedupes by dedupeKey keeping the latest payload', () => {
        const storage = memoryStorage()
        const engine = new SyncQueueEngine({
            storageKey: 'test_q',
            getStorage: () => storage,
            executeOp: jest.fn().mockResolvedValue(undefined),
        })

        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.TEMPLATE_UPDATE,
            dedupeKey: 'template:update:1',
            payload: { a: 1 },
        })
        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.TEMPLATE_UPDATE,
            dedupeKey: 'template:update:1',
            payload: { a: 2 },
        })

        expect(engine.getSnapshot()).toHaveLength(1)
        expect(engine.getSnapshot()[0].payload).toEqual({ a: 2 })
    })

    it('flush sends items in FIFO order', async () => {
        const storage = memoryStorage()
        const order: number[] = []
        const executeOp = jest.fn(async (_kind: string, payload: unknown) => {
            order.push((payload as { order: number }).order)
        })

        const engine = new SyncQueueEngine({
            storageKey: 'test_q2',
            getStorage: () => storage,
            executeOp,
        })

        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.START,
            dedupeKey: 'workout:start:a',
            payload: { order: 1 },
        })
        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.START,
            dedupeKey: 'workout:start:b',
            payload: { order: 2 },
        })

        const n = await engine.flush()
        expect(n).toBe(2)
        expect(order).toEqual([1, 2])
        expect(engine.getSnapshot()).toHaveLength(0)
    })

    it('stops flush on recoverable error with backoff', async () => {
        const storage = memoryStorage()
        const executeOp = jest
            .fn()
            .mockRejectedValueOnce(
                new AppHttpError(
                    clientError({
                        status: null,
                        code: 'NETWORK_ERROR',
                        message: 'offline',
                    }),
                ),
            )

        const engine = new SyncQueueEngine({
            storageKey: 'test_q3',
            getStorage: () => storage,
            executeOp,
        })

        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.START,
            dedupeKey: 'workout:start:x',
            payload: {},
        })

        const n = await engine.flush()
        expect(n).toBe(0)
        expect(engine.getSnapshot()).toHaveLength(1)
        expect(engine.getSnapshot()[0].attempts).toBe(1)
        expect(engine.getSnapshot()[0].nextRetryAt).toBeGreaterThan(Date.now())
    })

    it('drops item on non-recoverable error and continues', async () => {
        const storage = memoryStorage()
        const executeOp = jest
            .fn()
            .mockRejectedValueOnce(
                new AppHttpError(
                    clientError({
                        status: 404,
                        code: 'NOT_FOUND',
                        message: 'gone',
                    }),
                ),
            )
            .mockResolvedValueOnce(undefined)

        const engine = new SyncQueueEngine({
            storageKey: 'test_q4',
            getStorage: () => storage,
            executeOp,
        })

        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.COMPLETE,
            dedupeKey: 'workout:complete:1',
            payload: {},
        })
        engine.enqueue({
            kind: WORKOUT_SYNC_KINDS.COMPLETE,
            dedupeKey: 'workout:complete:2',
            payload: {},
        })

        const n = await engine.flush()
        expect(n).toBe(1)
        expect(engine.getSnapshot()).toHaveLength(0)
    })
})
