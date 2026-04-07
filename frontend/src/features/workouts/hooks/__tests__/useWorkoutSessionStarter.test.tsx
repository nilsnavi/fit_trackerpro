import { act, renderHook } from '@testing-library/react'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { useWorkoutSessionStarter } from '../useWorkoutSessionStarter'

jest.mock('@shared/lib/businessMetrics', () => ({
    trackBusinessMetric: jest.fn(),
}))

const startMutateAsync = jest.fn()
const updateMutateAsync = jest.fn()

const mockedIsOfflineMutationQueuedError = jest.fn((err: unknown) => Boolean((err as { offline?: boolean })?.offline))

jest.mock('../useWorkoutMutations', () => ({
    useStartWorkoutMutation: () => ({
        mutateAsync: startMutateAsync,
        isPending: false,
    }),
    useUpdateWorkoutSessionMutation: () => ({
        mutateAsync: updateMutateAsync,
        isPending: false,
    }),
}))

jest.mock('@shared/offline/syncQueue', () => ({
    isOfflineMutationQueuedError: (err: unknown) => mockedIsOfflineMutationQueuedError(err),
}))

describe('useWorkoutSessionStarter', () => {
    beforeEach(() => {
        startMutateAsync.mockReset()
        updateMutateAsync.mockReset()
        mockedIsOfflineMutationQueuedError.mockClear()
        useWorkoutSessionDraftStore.getState().clearDraft()
    })

    it('starts workout and writes draft without patch when patch payload is absent', async () => {
        startMutateAsync.mockResolvedValue({ id: 101, template_id: null })

        const { result } = renderHook(() => useWorkoutSessionStarter())

        await act(async () => {
            const started = await result.current.startWorkoutSession({
                startPayload: { name: 'Тестовая тренировка' },
            })
            expect(started?.id).toBe(101)
        })

        expect(startMutateAsync).toHaveBeenCalledWith({ name: 'Тестовая тренировка' })
        expect(updateMutateAsync).not.toHaveBeenCalled()

        const draft = useWorkoutSessionDraftStore.getState()
        expect(draft.workoutId).toBe(101)
        expect(draft.title).toBe('Тестовая тренировка')
        expect(draft.templateId).toBeNull()
    })

    it('applies patch payload and prefers explicit draft template id when server does not provide template', async () => {
        startMutateAsync.mockResolvedValue({ id: 202, template_id: null })
        updateMutateAsync.mockResolvedValue({ ok: true })

        const { result } = renderHook(() => useWorkoutSessionStarter())

        await act(async () => {
            const started = await result.current.startWorkoutSession({
                startPayload: { name: 'Повтор', template_id: 77 },
                patchPayload: {
                    exercises: [],
                    tags: [],
                    comments: 'patched',
                },
                draft: { title: 'Повтор custom', templateId: 55 },
            })
            expect(started?.id).toBe(202)
        })

        expect(updateMutateAsync).toHaveBeenCalledWith({
            workoutId: 202,
            payload: {
                exercises: [],
                tags: [],
                comments: 'patched',
            },
        })

        const draft = useWorkoutSessionDraftStore.getState()
        expect(draft.workoutId).toBe(202)
        expect(draft.title).toBe('Повтор custom')
        expect(draft.templateId).toBe(55)
    })

    it('returns null and triggers callback when mutation is queued offline', async () => {
        const offlineError = { offline: true }
        const onOfflineQueued = jest.fn()
        startMutateAsync.mockRejectedValue(offlineError)

        const { result } = renderHook(() => useWorkoutSessionStarter())

        await act(async () => {
            const started = await result.current.startWorkoutSession({
                startPayload: { name: 'Offline start' },
                onOfflineQueued,
            })
            expect(started).toBeNull()
        })

        expect(onOfflineQueued).toHaveBeenCalledTimes(1)
        const draft = useWorkoutSessionDraftStore.getState()
        expect(draft.workoutId).toBeNull()
    })

    it('rethrows non-offline errors', async () => {
        const regularError = new Error('boom')
        startMutateAsync.mockRejectedValue(regularError)

        const { result } = renderHook(() => useWorkoutSessionStarter())

        await expect(
            result.current.startWorkoutSession({
                startPayload: { name: 'Failing start' },
            }),
        ).rejects.toThrow('boom')
    })
})
