import {
    enqueueOfflineTemplateCreate,
    enqueueOfflineTemplateUpdate,
    enqueueOfflineWorkoutStart,
    enqueueOfflineWorkoutSessionUpdate,
    enqueueOfflineWorkoutComplete,
} from '../workoutOfflineEnqueue'
import { OfflineMutationQueuedError, WORKOUT_SYNC_KINDS } from '@shared/offline/syncQueue'
import type { EnqueueResult, SyncQueueItem } from '@shared/offline/syncQueue'

// Mock the syncQueue module to capture enqueue calls without hitting real storage.
const mockEnqueue = jest.fn()
const mockFlush = jest.fn()

jest.mock('@shared/offline/syncQueue', () => {
    const actual = jest.requireActual('@shared/offline/syncQueue')
    return {
        ...actual,
        enqueueSyncMutation: (...args: unknown[]) => mockEnqueue(...args),
        requestSyncFlush: () => mockFlush(),
    }
})

function makeResult(item: Partial<SyncQueueItem> = {}): EnqueueResult {
    return {
        item: {
            id: 'test-id',
            kind: 'workout.start',
            dedupeKey: 'test',
            payload: {},
            createdAt: Date.now(),
            attempts: 0,
            status: 'pending',
            nextRetryAt: 0,
            ...item,
        },
        replacedDuplicate: false,
    }
}

describe('workoutOfflineEnqueue', () => {
    beforeEach(() => {
        mockEnqueue.mockReturnValue(makeResult())
        mockFlush.mockReturnValue(undefined)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('enqueueOfflineTemplateCreate', () => {
        it('enqueues with TEMPLATE_CREATE kind and throws OfflineMutationQueuedError', () => {
            const payload = { name: 'Test', type: 'strength' as const, exercises: [], is_public: false }
            expect(() => enqueueOfflineTemplateCreate(payload)).toThrow(OfflineMutationQueuedError)

            expect(mockEnqueue).toHaveBeenCalledWith(
                expect.objectContaining({ kind: WORKOUT_SYNC_KINDS.TEMPLATE_CREATE }),
            )
            expect(mockFlush).toHaveBeenCalledTimes(1)
        })
    })

    describe('enqueueOfflineTemplateUpdate', () => {
        it('uses dedupeKey containing templateId and throws OfflineMutationQueuedError', () => {
            const payload = { name: 'Updated', type: 'strength' as const, exercises: [], is_public: false }
            expect(() => enqueueOfflineTemplateUpdate(42, payload)).toThrow(OfflineMutationQueuedError)

            const call = mockEnqueue.mock.calls[0][0] as { dedupeKey: string; kind: string }
            expect(call.kind).toBe(WORKOUT_SYNC_KINDS.TEMPLATE_UPDATE)
            expect(call.dedupeKey).toContain('42')
        })
    })

    describe('enqueueOfflineWorkoutStart', () => {
        it('uses a bucket-based dedupeKey and throws OfflineMutationQueuedError', () => {
            const before = Math.floor(Date.now() / 10_000)
            const payload = { name: 'Morning Run', type: 'cardio' as const }
            expect(() => enqueueOfflineWorkoutStart(payload)).toThrow(OfflineMutationQueuedError)

            const call = mockEnqueue.mock.calls[0][0] as { dedupeKey: string; kind: string }
            expect(call.kind).toBe(WORKOUT_SYNC_KINDS.START)
            // dedupeKey should embed the current time bucket (within 1 bucket range)
            const after = Math.floor(Date.now() / 10_000)
            expect(call.dedupeKey).toMatch(new RegExp(`workout:start:(${before}|${after})`))
        })
    })

    describe('enqueueOfflineWorkoutSessionUpdate', () => {
        it('includes idempotencyKey and throws OfflineMutationQueuedError', () => {
            const payload = { exercises: [], tags: [] }
            expect(() => enqueueOfflineWorkoutSessionUpdate(99, payload)).toThrow(OfflineMutationQueuedError)

            const call = mockEnqueue.mock.calls[0][0] as { dedupeKey: string; kind: string; idempotencyKey?: string }
            expect(call.kind).toBe(WORKOUT_SYNC_KINDS.SESSION_UPDATE)
            expect(call.dedupeKey).toBe('workout:update:99')
            expect(call.idempotencyKey).toMatch(/^session:update:99:/)
        })
    })

    describe('enqueueOfflineWorkoutComplete', () => {
        it('uses dedupeKey workout:complete:{id} and throws OfflineMutationQueuedError', () => {
            const payload = { duration: 45, exercises: [], tags: ['strength'] }
            expect(() => enqueueOfflineWorkoutComplete(77, payload)).toThrow(OfflineMutationQueuedError)

            const call = mockEnqueue.mock.calls[0][0] as { dedupeKey: string; kind: string; idempotencyKey?: string }
            expect(call.kind).toBe(WORKOUT_SYNC_KINDS.COMPLETE)
            expect(call.dedupeKey).toBe('workout:complete:77')
            expect(call.idempotencyKey).toMatch(/^session:complete:77:/)
        })
    })
})
