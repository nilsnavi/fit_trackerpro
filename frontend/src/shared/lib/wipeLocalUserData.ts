/**
 * Removes everything the app keeps about the user on this device and in Telegram
 * CloudStorage. Used after account deletion (legal: «удаляет аккаунт и связанные
 * данные»). Best-effort by design: every step is isolated, so one failing store
 * (private mode, blocked IndexedDB, no Telegram) never stops the others.
 *
 * Call only after the app tree is unmounted — otherwise persisted stores, the sync
 * queue runner and the query persister may write data straight back.
 */
import { clearSyncQueue } from '@shared/offline/syncQueue'
import { deleteIndexedDbKV } from '@shared/offline/storage/indexedDbKV'
import { useAuthStore } from '@/stores/authStore'

export interface WipeLocalUserDataReport {
    syncQueue: boolean
    localStorage: boolean
    sessionStorage: boolean
    indexedDb: boolean
    /** `null` — not running inside Telegram (no CloudStorage). */
    telegramCloudStorage: boolean | null
}

const TELEGRAM_CLOUD_TIMEOUT_MS = 3000

function attempt(step: () => void): boolean {
    try {
        step()
        return true
    } catch {
        return false
    }
}

function clearTelegramCloudStorage(): Promise<boolean | null> {
    const cloud = typeof window !== 'undefined' ? window.Telegram?.WebApp?.CloudStorage : undefined
    if (!cloud || typeof cloud.getKeys !== 'function' || typeof cloud.removeItems !== 'function') {
        return Promise.resolve(null)
    }
    return new Promise<boolean>((resolve) => {
        let settled = false
        const finish = (ok: boolean) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(ok)
        }
        // Older clients may never call back.
        const timer = setTimeout(() => finish(false), TELEGRAM_CLOUD_TIMEOUT_MS)
        try {
            cloud.getKeys((error, keys) => {
                if (error) return finish(false)
                if (!keys || keys.length === 0) return finish(true)
                cloud.removeItems(keys, (removeError) => finish(!removeError))
            })
        } catch {
            finish(false)
        }
    })
}

export async function wipeLocalUserData(): Promise<WipeLocalUserDataReport> {
    // In-memory state first: the queue engine would otherwise re-persist its items.
    const syncQueue = attempt(() => clearSyncQueue())
    attempt(() => useAuthStore.getState().clear())

    const localStorageCleared = attempt(() => window.localStorage.clear())
    const sessionStorageCleared = attempt(() => window.sessionStorage.clear())

    const [indexedDb, telegramCloudStorage] = await Promise.all([
        deleteIndexedDbKV().catch(() => false),
        clearTelegramCloudStorage(),
    ])

    return {
        syncQueue,
        localStorage: localStorageCleared,
        sessionStorage: sessionStorageCleared,
        indexedDb,
        telegramCloudStorage,
    }
}
