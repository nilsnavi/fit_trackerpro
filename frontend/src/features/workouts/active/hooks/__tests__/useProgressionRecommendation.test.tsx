import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { progressionApi } from '@shared/api/domains/progressionApi'
import {
    progressionQueryKeys,
    useAcceptProgressionRecommendation,
    useExerciseProgressionPolicy,
    useExerciseProgressionRecommendation,
    useRejectProgressionRecommendation,
    useSaveProgressionPolicy,
} from '../useProgressionRecommendation'

jest.mock('@shared/api/domains/progressionApi', () => ({
    progressionApi: {
        getExercisePolicy: jest.fn(),
        updateExercisePolicy: jest.fn(),
        getExerciseRecommendation: jest.fn(),
        getExerciseHistory: jest.fn(),
        acceptRecommendation: jest.fn(),
        rejectRecommendation: jest.fn(),
    },
}))

const mockedApi = progressionApi as jest.Mocked<typeof progressionApi>

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

const recommendation = {
    id: 7,
    exercise_id: 1,
    status: 'INCREASE' as const,
    recommended_value: 82.5,
    policy: 'DOUBLE_PROGRESSION' as const,
    reason_code: 'REP_RANGE_COMPLETED',
    reason_text: 'Верхняя граница достигнута',
    confidence: 'high' as const,
}

beforeEach(() => {
    jest.clearAllMocks()
})

describe('progression hooks (SPEC-006)', () => {
    it('fetches the stored recommendation for a scope', async () => {
        mockedApi.getExerciseRecommendation.mockResolvedValue(recommendation)

        const { result } = renderHook(
            () =>
                useExerciseProgressionRecommendation({
                    exerciseId: 1,
                    templateId: 5,
                    templateExerciseId: 9,
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.data).toEqual(recommendation))
        expect(mockedApi.getExerciseRecommendation).toHaveBeenCalledWith(1, {
            template_id: 5,
            template_exercise_id: 9,
        })
    })

    it('does not fetch without an exercise id', () => {
        const { result } = renderHook(
            () => useExerciseProgressionRecommendation({ exerciseId: 0 }),
            { wrapper: createWrapper() },
        )
        expect(result.current.fetchStatus).toBe('idle')
        expect(mockedApi.getExerciseRecommendation).not.toHaveBeenCalled()
    })

    it('loads the effective policy', async () => {
        mockedApi.getExercisePolicy.mockResolvedValue({
            id: null,
            user_id: 1,
            exercise_id: 1,
            scope_key: 'u1:e1',
            type: 'MANUAL',
            policy_version: 'MANUAL_V1',
            enabled: true,
        })

        const { result } = renderHook(() => useExerciseProgressionPolicy({ exerciseId: 1 }), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.data?.type).toBe('MANUAL'))
    })

    it('saves a policy and accepts a recommendation', async () => {
        mockedApi.updateExercisePolicy.mockResolvedValue({
            id: 3,
            user_id: 1,
            exercise_id: 1,
            scope_key: 'u1:e1',
            type: 'DOUBLE_PROGRESSION',
            policy_version: 'DOUBLE_PROGRESSION_V1',
            enabled: true,
        })
        mockedApi.acceptRecommendation.mockResolvedValue({
            ...recommendation,
            lifecycle_status: 'accepted',
            actual_selected_value: 82.5,
        })

        const save = renderHook(() => useSaveProgressionPolicy(), { wrapper: createWrapper() })
        await act(async () => {
            await save.result.current.mutateAsync({
                exerciseId: 1,
                payload: { type: 'DOUBLE_PROGRESSION', reps_min: 8, reps_max: 12 },
                params: { template_id: 2 },
            })
        })
        expect(mockedApi.updateExercisePolicy).toHaveBeenCalledWith(
            1,
            { type: 'DOUBLE_PROGRESSION', reps_min: 8, reps_max: 12 },
            { template_id: 2 },
        )

        const accept = renderHook(() => useAcceptProgressionRecommendation(), {
            wrapper: createWrapper(),
        })
        await act(async () => {
            await accept.result.current.mutateAsync({ recommendationId: 7, selectedValue: 85 })
        })
        expect(mockedApi.acceptRecommendation).toHaveBeenCalledWith(7, 85)
    })

    it('rejects a recommendation', async () => {
        mockedApi.rejectRecommendation.mockResolvedValue({
            ...recommendation,
            lifecycle_status: 'rejected',
        })

        const { result } = renderHook(() => useRejectProgressionRecommendation(), {
            wrapper: createWrapper(),
        })
        await act(async () => {
            await result.current.mutateAsync({ recommendationId: 7 })
        })
        expect(mockedApi.rejectRecommendation).toHaveBeenCalledWith(7)
    })

    it('builds scope-aware query keys', () => {
        expect(progressionQueryKeys.recommendation(1)).toEqual([
            'workouts',
            'progression',
            'recommendation',
            1,
            null,
            null,
        ])
        expect(progressionQueryKeys.recommendation(1, { template_id: 4 })).toContain(4)
        expect(progressionQueryKeys.history(1)).toContain('history')
    })
})
