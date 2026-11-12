/**
 * useWorkoutSessionDraftCloudSync: cloud hydration, conflict resolution by
 * updatedAt, removal when there is no active session, and immediate flush on
 * pagehide / visibilitychange(hidden).
 */
import { act, renderHook, waitFor } from '@testing-library/react'

import { WORKOUT_SESSION_DRAFT_CLOUD_KEY } from '@shared/lib/workoutSessionDraftCloud'
import { useWorkoutSessionDraftCloudSync } from '@shared/hooks/useWorkoutSessionDraftCloudSync'

interface DraftState {
    workoutId: number | null
    templateId: number | null
    title: string | null
    updatedAt: number
    hydrateFromRemote: jest.Mock
}

interface DraftStore {
    getState: () => DraftState
    setState: (partial: Partial<DraftState>) => void
    subscribe: (fn: (state: DraftState, prev: DraftState) => void) => () => void
    persist: {
        hasHydrated: () => boolean
        onFinishHydration: (fn: () => void) => () => void
    }
}

interface CloudStorage {
    getItem: jest.Mock
    setItem: jest.Mock
    removeItem: jest.Mock
}

const cloud: CloudStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}

jest.mock('@/state/local', () => {
    const state: DraftState = {
        workoutId: null,
        templateId: null,
        title: null,
        updatedAt: 0,
        hydrateFromRemote: jest.fn(),
    }
    const listeners = new Set<(state: DraftState, prev: DraftState) => void>()
    const store: DraftStore = {
        getState: () => state,
        setState: (partial) => {
            const prev = { ...state }
            Object.assign(state, partial)
            listeners.forEach((fn) => fn({ ...state }, prev))
        },
        subscribe: (fn) => {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
        persist: { hasHydrated: () => true, onFinishHydration: () => () => {} },
    }
    return { useWorkoutSessionDraftStore: store }
})

jest.mock('@app/providers/TelegramProvider', () => ({
    useTelegramContext: () => (globalThis as unknown as { __tg: unknown }).__tg,
}))

const store = getDraftStore()

function getDraftStore(): DraftStore {
    // The module is mocked above; require lazily so the factory has run.
    const mod = require('@/state/local') as { useWorkoutSessionDraftStore: DraftStore }
    return mod.useWorkoutSessionDraftStore
}

function resetDraft(overrides: Partial<DraftState> = {}): DraftState {
    const state = store.getState()
    Object.assign(state, {
        workoutId: null,
        templateId: null,
        title: null,
        updatedAt: 0,
        ...overrides,
    })
    state.hydrateFromRemote.mockReset()
    return state
}

beforeEach(() => {
    cloud.getItem.mockReset().mockResolvedValue(null)
    cloud.setItem.mockReset().mockResolvedValue(undefined)
    cloud.removeItem.mockReset().mockResolvedValue(undefined)
    ;(globalThis as unknown as { __tg: unknown }).__tg = {
        isTelegram: true,
        cloudStorage: cloud,
    }
})

afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
    })
})

describe('useWorkoutSessionDraftCloudSync', () => {
    it('hydrates the local draft from cloud when the cloud copy is newer', async () => {
        const state = resetDraft({ updatedAt: 100 })
        cloud.getItem.mockResolvedValue(
            JSON.stringify({ workoutId: 7, templateId: 3, title: 'Cloud', updatedAt: 200 }),
        )

        renderHook(() => useWorkoutSessionDraftCloudSync())

        await waitFor(() =>
            expect(state.hydrateFromRemote).toHaveBeenCalledWith({
                workoutId: 7,
                templateId: 3,
                title: 'Cloud',
                updatedAt: 200,
            }),
        )
    })

    it('pushes the local draft when the local copy is newer than cloud', async () => {
        resetDraft({ workoutId: 42, templateId: 5, title: 'Local', updatedAt: 500 })
        cloud.getItem.mockResolvedValue(
            JSON.stringify({ workoutId: 1, title: 'Old', updatedAt: 100 }),
        )

        renderHook(() => useWorkoutSessionDraftCloudSync())

        await waitFor(() => expect(cloud.setItem).toHaveBeenCalled())
        const [key, payload] = cloud.setItem.mock.calls[0] as [string, string]
        expect(key).toBe(WORKOUT_SESSION_DRAFT_CLOUD_KEY)
        expect(JSON.parse(payload)).toEqual({
            workoutId: 42,
            templateId: 5,
            title: 'Local',
            updatedAt: 500,
        })
    })

    it('removes the cloud key when there is no active session', async () => {
        resetDraft({ workoutId: null, updatedAt: 0 })
        cloud.getItem.mockResolvedValue(null)

        renderHook(() => useWorkoutSessionDraftCloudSync())

        act(() => {
            store.setState({ title: 'changed' })
        })
        act(() => {
            window.dispatchEvent(new Event('pagehide'))
        })

        await waitFor(() =>
            expect(cloud.removeItem).toHaveBeenCalledWith(WORKOUT_SESSION_DRAFT_CLOUD_KEY),
        )
    })

    it('flushes immediately on visibilitychange(hidden) without waiting for debounce', async () => {
        const state = resetDraft({ updatedAt: 100 })
        cloud.getItem.mockResolvedValue(
            JSON.stringify({ workoutId: 1, title: 'Cloud', updatedAt: 200 }),
        )

        renderHook(() => useWorkoutSessionDraftCloudSync())
        await waitFor(() => expect(state.hydrateFromRemote).toHaveBeenCalled())

        cloud.setItem.mockClear()
        act(() => {
            store.setState({ workoutId: 9, title: 'Live', updatedAt: 1000 })
        })
        act(() => {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true,
            })
            document.dispatchEvent(new Event('visibilitychange'))
        })

        await waitFor(() => expect(cloud.setItem).toHaveBeenCalled())
    })
})