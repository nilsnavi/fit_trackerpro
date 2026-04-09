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

    it('marks item failed on non-recoverable error and continues', async () => {
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
        expect(engine.getSnapshot()).toHaveLength(1)
        expect(engine.getSnapshot()[0].status).toBe('failed')
    })

    it('clearAll removes all items and notifies listeners', () => {
        const storage = memoryStorage()
        const engine = new SyncQueueEngine({
            storageKey: 'test_clear',
            getStorage: () => storage,
            executeOp: jest.fn(),
        })

        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'a', payload: {} })
        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'b', payload: {} })

        const listener = jest.fn()
        engine.subscribe(listener)
        engine.clearAll()

        expect(engine.getSnapshot()).toHaveLength(0)
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('removeById removes only the targeted item', () => {
        const storage = memoryStorage()
        const engine = new SyncQueueEngine({
            storageKey: 'test_remove',
            getStorage: () => storage,
            executeOp: jest.fn(),
        })

        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'rmv:a', payload: {} })
        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'rmv:b', payload: {} })

        const targetId = engine.getSnapshot()[0].id
        engine.removeById(targetId)

        expect(engine.getSnapshot()).toHaveLength(1)
        expect(engine.getSnapshot()[0].dedupeKey).toBe('rmv:b')
    })

    it('pendingCount and failedCount return correct values', async () => {
        const storage = memoryStorage()
        const executeOp = jest.fn().mockRejectedValue(
            new AppHttpError(clientError({ status: 422, code: 'UNPROCESSABLE', message: 'bad' })),
        )

        const engine = new SyncQueueEngine({
            storageKey: 'test_counts',
            getStorage: () => storage,
            executeOp,
        })

        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'cnt:1', payload: {} })
        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'cnt:2', payload: {} })

        expect(engine.pendingCount()).toBe(2)
        expect(engine.failedCount()).toBe(0)

        await engine.flush()

        expect(engine.failedCount()).toBe(2)
        expect(engine.pendingCount()).toBe(0)
    })

    it('subscribe returns unsubscribe fn; listener not called after unsubscribe', () => {
        const storage = memoryStorage()
        const engine = new SyncQueueEngine({
            storageKey: 'test_subscribe',
            getStorage: () => storage,
            executeOp: jest.fn(),
        })

        const listener = jest.fn()
        const unsubscribe = engine.subscribe(listener)

        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'sub:1', payload: {} })
        expect(listener).toHaveBeenCalledTimes(1)

        unsubscribe()
        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'sub:2', payload: {} })
        expect(listener).toHaveBeenCalledTimes(1) // unchanged after unsubscribe
    })

    it('flush returns 0 immediately if already processing (no concurrent re-entry)', async () => {
        const storage = memoryStorage()
        let resolveOp!: () => void
        const executeOp = jest.fn(() => new Promise<void>((res) => { resolveOp = res }))

        const engine = new SyncQueueEngine({
            storageKey: 'test_concurrent',
            getStorage: () => storage,
            executeOp,
        })

        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.START, dedupeKey: 'conc:1', payload: {} })

        // Start first flush — it will be stuck on executeOp
        const flush1 = engine.flush()
        // Attempt a second flush while first is in progress
        const flush2 = engine.flush()

        const n2 = await flush2
        expect(n2).toBe(0)

        // Now unblock first flush
        resolveOp()
        const n1 = await flush1
        expect(n1).toBe(1)
    })

    it('normalizeOnLoad: processing items are reset to pending on engine creation', () => {
        const storage = memoryStorage()

        // Manually seed storage with a 'processing' item (simulates crashed mid-flush)
        storage.setItem('test_normalize', JSON.stringify({
            v: 1,
            items: [{
                id: 'frozen-item',
                kind: WORKOUT_SYNC_KINDS.START,
                dedupeKey: 'norm:1',
                payload: {},
                createdAt: Date.now() - 5000,
                attempts: 0,
                status: 'processing',
                nextRetryAt: 0,
            }],
        }))

        const engine = new SyncQueueEngine({
            storageKey: 'test_normalize',
            getStorage: () => storage,
            executeOp: jest.fn(),
        })

        expect(engine.getSnapshot()[0].status).toBe('pending')
    })

    it('retryItem resets attempts and triggers flush', async () => {
        const storage = memoryStorage()
        const executeOp = jest.fn()
            .mockRejectedValueOnce(new AppHttpError(clientError({ status: 500, code: 'SERVER', message: 'err' })))
            .mockResolvedValueOnce(undefined)

        const engine = new SyncQueueEngine({
            storageKey: 'test_retry',
            getStorage: () => storage,
            executeOp,
        })

        engine.enqueue({ kind: WORKOUT_SYNC_KINDS.COMPLETE, dedupeKey: 'retry:1', payload: {} })
        await engine.flush()

        // After flush with 5xx: item is pending with attempts=1, nextRetryAt in future
        const item = engine.getSnapshot()[0]
        expect(item.attempts).toBe(1)
        expect(item.nextRetryAt).toBeGreaterThan(Date.now())

        // Force-reset nextRetryAt so retryItem flush can proceed immediately
        // (retryItem resets attempts=0, nextRetryAt=0 before flushing)
        await engine.retryItem(item.id)

        expect(engine.getSnapshot()).toHaveLength(0)
        expect(executeOp).toHaveBeenCalledTimes(2)
    })
})
