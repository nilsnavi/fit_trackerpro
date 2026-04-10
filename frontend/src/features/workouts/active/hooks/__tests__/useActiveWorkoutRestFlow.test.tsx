import { renderHook } from '@testing-library/react'
import type { UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { useActiveWorkoutRestFlow } from '../useActiveWorkoutRestFlow'

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

function makeWorkout(completedFirst: boolean): WorkoutHistoryItem {
    return {
        id: 1,
        date: '2026-04-10',
        duration: undefined,
        exercises: [
            {
                exercise_id: 10,
                name: 'Bench',
                sets_completed: [
                    { set_number: 1, reps: 5, weight: 50, completed: completedFirst },
                    { set_number: 2, reps: 5, weight: 50, completed: false },
                ],
            },
        ],
        comments: 'draft',
        tags: [],
        created_at: '2026-04-10T10:00:00.000Z',
    }
}

describe('useActiveWorkoutRestFlow', () => {
    it('returns empty rest patch for first completed set', () => {
        const workout = makeWorkout(false)
        const { result } = renderHook(() =>
            useActiveWorkoutRestFlow({
                workout,
                profileId: 1,
                templateId: 1,
                previousBestByExercise: new Map(),
                restDefaultSeconds: 60,
                restTimer: { durationSeconds: 0, remainingSeconds: 0 },
                scopedDefaultRestSeconds: 60,
                restPresets: [],
                setRestDefaultSeconds: jest.fn(),
                setDefaultRestForScope: jest.fn(),
                setPresetsForScope: jest.fn(),
                startRestTimer: jest.fn(),
                setCurrentPosition: jest.fn(),
                updateSet: jest.fn(),
                tg: makeTg(),
            }),
        )

        expect(result.current.getTrackedRestPatch(0, 1)).toEqual({})
    })

    it('includes planned/actual rest when completing after at least one set', () => {
        const workout = makeWorkout(true)
        const { result } = renderHook(() =>
            useActiveWorkoutRestFlow({
                workout,
                profileId: 1,
                templateId: 1,
                previousBestByExercise: new Map(),
                restDefaultSeconds: 90,
                restTimer: { durationSeconds: 90, remainingSeconds: 30 },
                scopedDefaultRestSeconds: 90,
                restPresets: [],
                setRestDefaultSeconds: jest.fn(),
                setDefaultRestForScope: jest.fn(),
                setPresetsForScope: jest.fn(),
                startRestTimer: jest.fn(),
                setCurrentPosition: jest.fn(),
                updateSet: jest.fn(),
                tg: makeTg(),
            }),
        )

        expect(result.current.getTrackedRestPatch(0, 2)).toEqual({
            planned_rest_seconds: 90,
            actual_rest_seconds: 60,
        })
    })
})

