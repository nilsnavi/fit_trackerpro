import { createIndexedDbKV } from '@shared/offline/storage/indexedDbKV'
import { enqueueSyncMutation, getSyncQueueEngine } from '@shared/offline/syncQueue'
import { useAuthStore } from '@/stores/authStore'
import { wipeLocalUserData } from '../wipeLocalUserData'

type CloudCallback<T> = (error: string | null, result?: T) => void

function installTelegramCloud(keys: string[] | 'never-answers') {
    const removeItems = jest.fn((_keys: string[], cb?: CloudCallback<boolean>) => cb?.(null, true))
    const getKeys = jest.fn((cb: CloudCallback<string[]>) => {
        if (keys !== 'never-answers') cb(null, keys)
    })
    ;(window as { Telegram?: unknown }).Telegram = { WebApp: { CloudStorage: { getKeys, removeItems } } }
    return { getKeys, removeItems }
}

describe('wipeLocalUserData', () => {
    afterEach(() => {
        delete (window as { Telegram?: unknown }).Telegram
        jest.useRealTimers()
    })

    it('clears device storage, the sync queue, the session and the offline IndexedDB', async () => {
        localStorage.setItem('workout-session-draft', '{"state":{}}')
        localStorage.setItem('oneRMHistory', '[1,2,3]')
        sessionStorage.setItem('return_url_after_login', '/profile')
        useAuthStore.getState().setTokens({ accessToken: 'a', refreshToken: 'r' })
        enqueueSyncMutation({ kind: 'workout.set.patch', payload: { workoutId: 1 }, dedupeKey: 'k1' })
        const kv = createIndexedDbKV()
        await kv.set('queryCache', 'fittracker_rq_offline_v2', '{"clientState":{}}')

        const report = await wipeLocalUserData()

        expect(report).toEqual({
            syncQueue: true,
            localStorage: true,
            sessionStorage: true,
            indexedDb: true,
            telegramCloudStorage: null,
        })
        expect(localStorage.length).toBe(0)
        expect(sessionStorage.length).toBe(0)
        expect(getSyncQueueEngine().getSnapshot()).toHaveLength(0)
        expect(useAuthStore.getState().isAuthenticated).toBe(false)
        // The database was deleted: a fresh connection sees no cached queries.
        await expect(createIndexedDbKV().get('queryCache', 'fittracker_rq_offline_v2')).resolves.toBeNull()
    })

    it('removes every key the bot stored in Telegram CloudStorage', async () => {
        const cloud = installTelegramCloud(['fitpro_workout_session_draft_v1', 'other'])

        const report = await wipeLocalUserData()

        expect(cloud.removeItems).toHaveBeenCalledWith(
            ['fitpro_workout_session_draft_v1', 'other'],
            expect.any(Function),
        )
        expect(report.telegramCloudStorage).toBe(true)
    })

    it('does not hang when Telegram never answers', async () => {
        jest.useFakeTimers()
        installTelegramCloud('never-answers')

        const pending = wipeLocalUserData()
        await jest.advanceTimersByTimeAsync(3000)

        await expect(pending).resolves.toMatchObject({ telegramCloudStorage: false, localStorage: true })
    })
})
