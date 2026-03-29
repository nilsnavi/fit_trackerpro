import type { Query } from '@tanstack/query-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const STORAGE_KEY = 'fittracker_rq_offline_v1'

/** Срок хранения совпадает с gcTime офлайн-запросов (см. useExercisesCatalogQuery). */
export const OFFLINE_QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7

export function createOfflineQueryPersister() {
    return createSyncStoragePersister({
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        key: STORAGE_KEY,
        throttleTime: 1000,
    })
}

/**
 * Персистим только каталог упражнений и будущие справочники API (`reference`, …),
 * чтобы не класть в localStorage профиль и прочие чувствительные данные.
 */
export function shouldDehydrateOfflineQuery(query: Query): boolean {
    if (query.state.status !== 'success') return false
    const key = query.queryKey
    if (!Array.isArray(key) || key.length < 2) return false
    if (key[0] === 'exercises' && key[1] === 'list') return true
    if (key[0] === 'reference') return true
    return false
}
