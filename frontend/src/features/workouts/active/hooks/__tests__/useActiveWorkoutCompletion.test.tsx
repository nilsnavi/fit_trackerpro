import { act, renderHook } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import type { UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp'
import { useActiveWorkoutCompletion } from '../useActiveWorkoutCompletion'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import type { NavigateFunction } from 'react-router-dom'

function makeTg(): UseTelegramWebAppReturn {
    return {
        webApp: null,
        isReady: true,
        user: null,
        theme: null,
        colorScheme: null,
        initData: '',
        launchMode: 'browser',
        init: () => undefined,
        getUser: () => null,
        getTheme: () => null,
        hapticFeedback: () => undefined,
        close: () => undefined,
        expand: () => undefined,
        isTelegram: false,
        showMainButton: () => undefined,
        hideMainButton: () => undefined,
        enableMainButton: () => undefined,
        disableMainButton: () => undefined,
        showMainButtonProgress: () => undefined,
        hideMainButtonProgress: () => undefined,
        showBackButton: () => undefined,
        hideBackButton: () => undefined,
        setHeaderColor: () => undefined,
        setBackgroundColor: () => undefined,
        showPopup: async () => null,
        showAlert: async () => undefined,
        showConfirm: async () => false,
        sendData: () => undefined,
        openLink: () => undefined,
        openTelegramLink: () => undefined,
        enableClosingConfirmation: () => undefined,
        disableClosingConfirmation: () => undefined,
        cloudStorage: {
            setItem: async () => true,
            getItem: async () => null,
            getItems: async () => null,
            removeItem: async () => true,
            removeItems: async () => true,
            getKeys: async () => null,
        },
    }
}

function makeWorkout(overrides: Partial<WorkoutHistoryItem> = {}): WorkoutHistoryItem {
    return {
        id: 1,
        date: '2026-04-10',
        duration: undefined,
        exercises: [
            {
                exercise_id: 10,
                name: 'Bench',
                sets_completed: [{ set_number: 1, reps: 5, weight: 50, completed: false }],
            },
        ],
        comments: 'draft',
        tags: [],
        created_at: '2026-04-10T10:00:00.000Z',
        ...overrides,
    }
}

describe('useActiveWorkoutCompletion', () => {
    it('validates duration range before calling mutate', () => {
        const queryClient = new QueryClient()
        const workout = makeWorkout()
        queryClient.setQueryData(['workouts', 'history', 'item', 1], workout)

        const completeMutation = {
            isPending: false,
            isError: false,
            error: null,
            mutate: jest.fn(),
        } as unknown as ReturnType<typeof import('@features/workouts/hooks/useWorkoutMutations')['useCompleteWorkoutMutation']>

        const { result } = renderHook(() =>
            useActiveWorkoutCompletion({
                workoutId: 1,
                workout,
                isActiveDraft: true,
                queryClient,
                tg: makeTg(),
                navigate: jest.fn() as unknown as NavigateFunction,
                completeMutation: completeMutation as never,
                flushWorkoutSync: async () => undefined,
                clearActiveWorkoutDraft: jest.fn(),
                skipRestTimer: jest.fn(),
                resetActiveWorkoutState: jest.fn(),
                abandonWorkoutSessionDraft: jest.fn(),
                detailQueryKey: ['workouts', 'history', 'item', 1],
                updateSessionFields: jest.fn(),
            }),
        )

        act(() => {
            result.current.setDurationMinutes(0)
        })
        act(() => {
            result.current.handleCompleteSession()
        })

        expect(result.current.sessionError).toBe('Укажите длительность от 1 до 1440 минут')
        expect((completeMutation.mutate as jest.Mock).mock.calls.length).toBe(0)
    })
})

