/**
 * SyncQueueEngine — offline/resilience test scenarios.
 *
 * Scenarios:
 *  6. dedupeKey replace         — second enqueue with same dedupeKey replaces pending
 *  7. flush sequential guard    — parallel flush() calls don't double-process
 *  8. recoverable error → backoff — element gets nextRetryAt > 0, flush stops
 *  9. non-recoverable → failed  — 4xx marks item failed, flush continues next item
 * 10. normalizeOnLoad           — items with status 'processing' reset to 'pending' on load
 */

import { SyncQueueEngine } from '../engine'
import { AppHttpError } from '@shared/errors'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEngine(executeOp?: (kind: string, payload: unknown) => Promise<void>) {
    const storage = new Map<string, string>()
    return new SyncQueueEngine({
        storageKey: 'test_queue',
        getStorage: () => ({
            getItem: (k: string) => storage.get(k) ?? null,
            setItem: (k: string, v: string) => { storage.set(k, v) },
            removeItem: (k: string) => { storage.delete(k) },
        }),
        executeOp: executeOp ?? (() => Promise.resolve()),
    })
}

function networkError() {
    return new AppHttpError({ status: null, code: 'NETWORK_ERROR', message: 'no connection' })
}

function clientError(status: number) {
    return new AppHttpError({ status, code: 'HTTP_ERROR', message: `HTTP ${status}` })
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SyncQueueEngine — offline scenarios', () => {
    // ── Scenario 6: dedupeKey replace ────────────────────────────────────────
    it('6. second enqueue with same dedupeKey replaces the pending item', () => {
        const engine = makeEngine()

        engine.enqueue({
            kind: 'workout.session.update',
            dedupeKey: 'workout:update:42',
            payload: { workoutId: 42, body: { exercises: [], comments: 'v1', tags: [] } },
        })

        engine.enqueue({
            kind: 'workout.session.update',
            dedupeKey: 'workout:update:42',
            payload: { workoutId: 42, body: { exercises: [], comments: 'v2', tags: [] } },
        })

        const items = engine.getSnapshot()
        // Only one item should remain
        expect(items).toHaveLength(1)
        // The payload should be the latest (v2)
        const payload = items[0].payload as { workoutId: number; body: { comments: string } }
        expect(payload.body.comments).toBe('v2')
    })

    // ── Scenario 7: flush sequential guard ───────────────────────────────────
    it('7. two parallel flush() calls do not double-process the same item', async () => {
        let execCount = 0
        const engine = makeEngine(async () => {
            execCount += 1
            // Simulate async work
            await new Promise((r) => setTimeout(r, 10))
        })

        engine.enqueue({
            kind: 'workout.session.update',
            dedupeKey: 'workout:update:1',
            payload: { workoutId: 1 },
        })

        // Fire both flushes concurrently
        await Promise.all([engine.flush(), engine.flush()])

        // The item should be executed exactly once
        expect(execCount).toBe(1)
        expect(engine.getSnapshot()).toHaveLength(0)
    })

    // ── Scenario 8: recoverable error → backoff ───────────────────────────────
    it('8. recoverable network error: item gets nextRetryAt > 0 and flush stops', async () => {
        const engine = makeEngine(async () => {
            throw networkError()
        })

        engine.enqueue({
            kind: 'workout.session.update',
            dedupeKey: 'workout:update:5',
            payload: { workoutId: 5 },
        })

        const before = Date.now()
        await engine.flush()

        const items = engine.getSnapshot()
        expect(items).toHaveLength(1)
        expect(items[0].status).toBe('pending')
        expect(items[0].attempts).toBe(1)
        expect(items[0].lastError).toBeDefined()
        // nextRetryAt must be in the future
        expect(items[0].nextRetryAt).toBeGreaterThan(before)
    })

    // ── Scenario 9: non-recoverable → failed, flush continues ────────────────
    it('9. 4xx error: item marked failed, flush proceeds to next item', async () => {
        let callCount = 0
        const engine = makeEngine(async (_kind, payload) => {
            callCount += 1
            const p = payload as { id: number }
            if (p.id === 1) {
                throw clientError(400)
            }
            // item id=2 succeeds
        })

        engine.enqueue({
            kind: 'workout.session.update',
            dedupeKey: 'item:1',
            payload: { id: 1 },
        })
        engine.enqueue({
            kind: 'workout.session.update',
            dedupeKey: 'item:2',
            payload: { id: 2 },
        })

        await engine.flush()

        // Both items were attempted
        expect(callCount).toBe(2)

        const items = engine.getSnapshot()
        // item:1 should be marked failed
        const failed = items.find((i) => (i.payload as { id: number }).id === 1)
        expect(failed?.status).toBe('failed')
        expect(failed?.failedAt).toBeDefined()

        // item:2 should be gone (successfully processed)
        const succeeded = items.find((i) => (i.payload as { id: number }).id === 2)
        expect(succeeded).toBeUndefined()
    })

    // ── Scenario 10: normalizeOnLoad ─────────────────────────────────────────
    it('10. items with status processing are reset to pending on engine init', () => {
        const storage = new Map<string, string>()
        const storageKey = 'test_normalize'

        // Pre-populate storage with a 'processing' item (simulates crash mid-flight)
        const staleData = {
            v: 1,
            items: [
                {
                    id: 'stale-1',
                    kind: 'workout.session.update',
                    dedupeKey: 'workout:update:99',
                    payload: { workoutId: 99 },
                    createdAt: Date.now() - 5000,
                    attempts: 1,
                    status: 'processing',
                    nextRetryAt: 0,
                },
            ],
        }
        storage.set(storageKey, JSON.stringify(staleData))

        const engine = new SyncQueueEngine({
            storageKey,
            getStorage: () => ({
                getItem: (k: string) => storage.get(k) ?? null,
                setItem: (k: string, v: string) => { storage.set(k, v) },
                removeItem: (k: string) => { storage.delete(k) },
            }),
            executeOp: () => Promise.resolve(),
        })

        const items = engine.getSnapshot()
        expect(items).toHaveLength(1)
        // Must be reset to pending so it can be retried
        expect(items[0].status).toBe('pending')
    })
})
