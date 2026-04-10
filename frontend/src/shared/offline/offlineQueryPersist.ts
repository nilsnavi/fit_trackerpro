import type { Query } from '@tanstack/query-core'
import type { Persister } from '@tanstack/query-persist-client-core'
import { createIndexedDbKV } from './storage/indexedDbKV'

const LEGACY_LOCAL_STORAGE_KEY = 'fittracker_rq_offline_v1'
const IDB_KEY = 'fittracker_rq_offline_v2'

/** Срок хранения совпадает с gcTime офлайн-запросов (см. useExercisesCatalogQuery). */
export const OFFLINE_QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7

/** Общие опции для запросов, чьи успешные ответы кладём в офлайн-персист. */
export const offlineListQueryDefaults = {
    gcTime: OFFLINE_QUERY_CACHE_MAX_AGE_MS,
    networkMode: 'offlineFirst' as const,
    retry: (failureCount: number) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return false
        }
        return failureCount < 1
    },
}

export function createOfflineQueryPersister() {
    // Best-effort cleanup: old localStorage cache must never break startup.
    // We intentionally do NOT migrate payloads from localStorage to IndexedDB
    // to avoid blocking the main thread on large JSON blobs.
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY)
        }
    } catch {
        // ignore
    }

    const kv = createIndexedDbKV()

    const idbPersister: Persister = {
        persistClient: async (client) => {
            try {
                await kv.set('queryCache', IDB_KEY, JSON.stringify(client))
            } catch {
                // IndexedDB may be blocked/denied/quota-limited. Never crash the app.
            }
        },
        restoreClient: async () => {
            try {
                const raw = await kv.get('queryCache', IDB_KEY)
                if (!raw) return undefined
                return JSON.parse(raw)
            } catch {
                return undefined
            }
        },
        removeClient: async () => {
            try {
                await kv.del('queryCache', IDB_KEY)
            } catch {
                // ignore
            }
        },
    }

    // Graceful fallback: if IndexedDB is unavailable, do not persist queries.
    // This avoids reintroducing the synchronous localStorage bottleneck.
    if (typeof indexedDB === 'undefined') {
        const noop: Persister = {
            persistClient: async () => {},
            restoreClient: async () => undefined,
            removeClient: async () => {},
        }
        return noop
    }

    return idbPersister
}

function isWorkoutsHistoryListKey(key: readonly unknown[]): boolean {
    if (key.length < 3) return false
    const third = key[2]
    return typeof third === 'object' && third !== null && !Array.isArray(third)
}

/**
 * Персистим каталог упражнений, справочники API (`reference`, …), последние
 * тренировки и шаблоны — чтобы при плохой сети оставались last-known данные.
 * Профиль и прочие чувствительные ключи не сохраняем.
 */
export function shouldDehydrateOfflineQuery(query: Query): boolean {
    if (query.state.status !== 'success') return false
    const key = query.queryKey
    if (!Array.isArray(key) || key.length < 2) return false
    if (key[0] === 'exercises' && key[1] === 'list') return true
    if (key[0] === 'reference') return true
    if (key[0] === 'workouts' && key[1] === 'history') {
        if (key[2] === 'item') return true
        return isWorkoutsHistoryListKey(key)
    }
    if (key[0] === 'workouts' && key[1] === 'templates') {
        return key[2] === 'list' || key[2] === 'detail'
    }
    return false
}
