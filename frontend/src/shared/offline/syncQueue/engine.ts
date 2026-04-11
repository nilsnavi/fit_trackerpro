import { isAppHttpError } from '@shared/errors'
import {
    emitWorkoutSyncTelemetry,
    isSyncConflictHttpError,
    notifyWorkoutSyncConflictDetected,
    resourceIdsFromSyncQueuePayload,
    syncErrorTelemetryFields,
} from '@shared/offline/observability/workoutSyncTelemetry'

import type { EnqueueResult, EnqueueSyncMutationInput, SyncQueueItem } from './types'
import { SYNC_QUEUE_MAX_ITEMS, SYNC_QUEUE_STORAGE_KEY } from './types'
import { isRecoverableSyncError } from './recoverableError'
import { WORKOUT_SYNC_KINDS } from './workoutKinds'

export type SyncQueueExecuteFn = (kind: string, payload: unknown) => Promise<void>

async function defaultExecuteWorkoutSyncOp(kind: string, payload: unknown): Promise<void> {
    const { executeWorkoutSyncOp } = await import('./executeWorkoutSyncOp')
    return executeWorkoutSyncOp(kind, payload)
}

function newId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function backoffMsAfterFailure(attempts: number): number {
    const capped = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6))
    const jitter = Math.floor(Math.random() * 400)
    return capped + jitter
}

function normalizeOnLoad(items: SyncQueueItem[]): SyncQueueItem[] {
    return items.map((i) =>
        i.status === 'processing' ? { ...i, status: 'pending' as const } : i,
    )
}

function conflictResourceForQueueItem(item: SyncQueueItem): {
    resource: 'workout' | 'template' | 'unknown'
    resource_id: number | null
} {
    const ids = resourceIdsFromSyncQueuePayload(item.payload)
    const k = item.kind
    if (k === WORKOUT_SYNC_KINDS.TEMPLATE_CREATE || k === WORKOUT_SYNC_KINDS.TEMPLATE_UPDATE) {
        return { resource: 'template', resource_id: ids.template_id }
    }
    if (k === WORKOUT_SYNC_KINDS.START) {
        return { resource: 'unknown', resource_id: ids.template_id }
    }
    return { resource: 'workout', resource_id: ids.workout_id }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type SyncQueueEngineOptions = {
    storageKey?: string
    getStorage?: () => StorageLike | null
    /** По умолчанию {@link executeWorkoutSyncOp}. */
    executeOp?: SyncQueueExecuteFn
}

/**
 * Очередь офлайн-мутаций: персистентность, дедупликация по dedupeKey,
 * последовательная отправка с exponential backoff.
 */
export class SyncQueueEngine {
    private readonly storageKey: string
    private readonly getStorage: () => StorageLike | null
    private readonly executeOp: SyncQueueExecuteFn
    private items: SyncQueueItem[] = []
    private listeners = new Set<() => void>()
    private processing = false

    constructor(options: SyncQueueEngineOptions = {}) {
        this.storageKey = options.storageKey ?? SYNC_QUEUE_STORAGE_KEY
        this.getStorage =
            options.getStorage ??
            (() => (typeof window !== 'undefined' ? window.localStorage : null))
        this.executeOp = options.executeOp ?? defaultExecuteWorkoutSyncOp
        this.items = this.load()
    }

    private load(): SyncQueueItem[] {
        const storage = this.getStorage()
        if (!storage) return []
        try {
            const raw = storage.getItem(this.storageKey)
            if (!raw) return []
            const parsed = JSON.parse(raw) as { v: number; items: SyncQueueItem[] }
            if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) {
                return []
            }
            return normalizeOnLoad(parsed.items)
        } catch {
            return []
        }
    }

    private persist(): void {
        const storage = this.getStorage()
        if (!storage) return
        try {
            const trimmed = this.items.slice(-SYNC_QUEUE_MAX_ITEMS)
            this.items = trimmed
            storage.setItem(this.storageKey, JSON.stringify({ v: 1, items: trimmed }))
        } catch {
            // квота / private mode — не роняем приложение
        }
    }

    private notify(): void {
        for (const fn of this.listeners) {
            try {
                fn()
            } catch {
                /* ignore */
            }
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    getSnapshot(): readonly SyncQueueItem[] {
        return this.items
    }

    /** true, пока выполняется {@link flush} (отправка операций на сервер). */
    isFlushActive(): boolean {
        return this.processing
    }

    pendingCount(): number {
        return this.items.filter((i) => i.status === 'pending').length
    }

    failedCount(): number {
        return this.items.filter((i) => i.status === 'failed').length
    }

    enqueue(input: EnqueueSyncMutationInput): EnqueueResult {
        const now = Date.now()
        const before = this.items.length
        this.items = this.items.filter(
            (i) => !(i.status === 'pending' && i.dedupeKey === input.dedupeKey),
        )
        const replacedDuplicate = before !== this.items.length

        const item: SyncQueueItem = {
            id: newId(),
            kind: input.kind,
            dedupeKey: input.dedupeKey,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
            expectedVersion: input.expectedVersion,
            createdAt: now,
            attempts: 0,
            status: 'pending',
            nextRetryAt: 0,
        }
        this.items.push(item)
        this.persist()
        this.notify()

        const ids = resourceIdsFromSyncQueuePayload(input.payload)
        emitWorkoutSyncTelemetry('local_update_queued', {
            channel: 'sync_queue',
            kind: input.kind,
            replaced_duplicate: replacedDuplicate,
            queue_depth: this.items.length,
            ...(ids.workout_id != null ? { workout_id: ids.workout_id } : {}),
            ...(ids.template_id != null ? { template_id: ids.template_id } : {}),
        })

        return { item, replacedDuplicate }
    }

    clearAll(): void {
        this.items = []
        this.persist()
        this.notify()
    }

    removeById(id: string): void {
        this.items = this.items.filter((i) => i.id !== id)
        this.persist()
        this.notify()
    }

    /** Получить все элементы очереди */
    getAllItems(): SyncQueueItem[] {
        return [...this.items]
    }

    /** Повторить попытку для конкретного элемента */
    async retryItem(itemId: string): Promise<void> {
        const idx = this.items.findIndex((i) => i.id === itemId)
        if (idx === -1) return

        const item = this.items[idx]
        this.items[idx] = {
            ...item,
            status: 'pending',
            attempts: 0,
            lastError: undefined,
            failedAt: undefined,
            nextRetryAt: 0,
        }
        this.persist()
        this.notify()

        emitWorkoutSyncTelemetry('sync_started', {
            channel: 'sync_queue',
            trigger: 'manual_item_retry',
            kind: item.kind,
            item_id_short: item.id.slice(0, 8),
        })

        // Запустить flush если онлайн
        try {
            await this.flush()
        } catch {
            // Игнорируем ошибки при автоматическом flush
        }
    }

    /** Удалить элемент по ID */
    deleteItem(itemId: string): void {
        this.removeById(itemId)
    }

    /**
     * Отправляет pending-элементы по порядку. При recoverable ошибке останавливается
     * (backoff на элементе). При «жёсткой» ошибке (4xx и т.д.) удаляет элемент и продолжает.
     * @returns число успешно отправленных операций.
     */
    async flush(): Promise<number> {
        if (this.processing) return 0
        this.processing = true
        this.notify()
        let completed = 0
        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const next = this.pickNext()
                if (!next) break

                const idx = this.items.findIndex((i) => i.id === next.id)
                if (idx === -1) continue

                this.items[idx] = {
                    ...this.items[idx],
                    status: 'processing',
                }
                this.persist()

                const pendingAhead = this.items.filter(
                    (i) => i.status === 'pending' && i.id !== next.id,
                ).length

                emitWorkoutSyncTelemetry('sync_started', {
                    channel: 'sync_queue',
                    kind: next.kind,
                    item_id_short: next.id.slice(0, 8),
                    pending_other: pendingAhead,
                    prior_attempts: next.attempts,
                })

                try {
                    await this.executeOp(next.kind, next.payload)
                    this.items = this.items.filter((i) => i.id !== next.id)
                    this.persist()
                    this.notify()
                    completed += 1

                    emitWorkoutSyncTelemetry('sync_succeeded', {
                        channel: 'sync_queue',
                        kind: next.kind,
                        item_id_short: next.id.slice(0, 8),
                    })
                    if (next.attempts > 0) {
                        emitWorkoutSyncTelemetry('retry_succeeded', {
                            channel: 'sync_queue',
                            kind: next.kind,
                            prior_attempts: next.attempts,
                        })
                    }
                } catch (error) {
                    const msg =
                        error instanceof Error ? error.message : String(error)
                    if (isRecoverableSyncError(error)) {
                        const attempts = next.attempts + 1
                        const delay = backoffMsAfterFailure(attempts)
                        this.items[idx] = {
                            ...next,
                            status: 'pending',
                            attempts,
                            lastError: msg,
                            nextRetryAt: Date.now() + delay,
                        }
                        this.persist()
                        this.notify()

                        emitWorkoutSyncTelemetry('sync_failed', {
                            channel: 'sync_queue',
                            kind: next.kind,
                            outcome: 'recoverable_backoff',
                            item_id_short: next.id.slice(0, 8),
                            attempts,
                            next_retry_in_ms: delay,
                            ...syncErrorTelemetryFields(error),
                        })
                        break
                    }
                    // Нерекаверибл ошибка: не теряем операцию молча — помечаем failed.
                    this.items[idx] = {
                        ...next,
                        status: 'failed',
                        lastError: msg,
                        failedAt: Date.now(),
                        nextRetryAt: 0,
                    }
                    this.persist()
                    this.notify()

                    if (isSyncConflictHttpError(error)) {
                        const cr = conflictResourceForQueueItem(next)
                        notifyWorkoutSyncConflictDetected({
                            resource: cr.resource,
                            resource_id: cr.resource_id,
                            reason: isAppHttpError(error) ? error.code : msg,
                            source: 'sync_queue',
                            http_status: isAppHttpError(error) ? error.status : null,
                            queue_kind: next.kind,
                        })
                    }

                    emitWorkoutSyncTelemetry('sync_failed', {
                        channel: 'sync_queue',
                        kind: next.kind,
                        outcome: 'terminal',
                        item_id_short: next.id.slice(0, 8),
                        ...syncErrorTelemetryFields(error),
                    })
                }
            }
        } finally {
            this.processing = false
            this.notify()
        }
        return completed
    }

    private pickNext(): SyncQueueItem | undefined {
        const now = Date.now()
        const ready = this.items.filter(
            (i) => i.status === 'pending' && i.nextRetryAt <= now,
        )
        ready.sort((a, b) => a.createdAt - b.createdAt)
        return ready[0]
    }
}

let singleton: SyncQueueEngine | null = null

export function getSyncQueueEngine(): SyncQueueEngine {
    if (!singleton) {
        singleton = new SyncQueueEngine()
    }
    return singleton
}

export function resetSyncQueueEngineForTests(engine: SyncQueueEngine | null): void {
    singleton = engine
}
