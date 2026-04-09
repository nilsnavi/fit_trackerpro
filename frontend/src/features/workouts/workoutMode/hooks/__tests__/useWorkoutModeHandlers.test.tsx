import { act, renderHook } from '@testing-library/react'
import { useWorkoutModeHandlers } from '../useWorkoutModeHandlers'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import type { WorkoutModeExerciseItem } from '@features/workouts/workoutMode/workoutModeEditorTypes'

const mockNavigate = jest.fn()
const mockStartWorkoutSession = jest.fn()
const mockMutateTemplate = jest.fn()
const mockMarkClean = jest.fn()

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}))

jest.mock('@features/workouts/hooks/useWorkoutSessionStarter', () => ({
    useWorkoutSessionStarter: () => ({
        startWorkoutSession: mockStartWorkoutSession,
        isStartingSession: false,
    }),
}))

jest.mock('@features/workouts/hooks/useWorkoutMutations', () => ({
    useCreateWorkoutTemplateMutation: () => ({
        mutate: mockMutateTemplate,
        isPending: false,
    }),
}))

jest.mock('@features/workouts/model/useWorkoutModeEditorStore', () => ({
    useWorkoutModeEditorStore: {
        getState: () => ({
            markClean: mockMarkClean,
        }),
    },
}))

jest.mock('@shared/stores/toastStore', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}))

jest.mock('@shared/offline/syncQueue', () => ({
    isOfflineMutationQueuedError: jest.fn(() => false),
}))

describe('useWorkoutModeHandlers', () => {
    const config = {
        title: 'Силовая',
        mode: 'strength',
        backendType: 'strength',
        tags: ['strength'],
    } as unknown as WorkoutTypeConfig

    const recentWorkout = {
        id: 900,
        comments: 'Вчерашняя',
        exercises: [
            {
                exercise_id: 1,
                name: 'Bench Press',
                sets_completed: [{ set_number: 1, reps: 8, weight: 60, completed: true }],
            },
        ],
    } as unknown as WorkoutHistoryItem

    const editorExercises: WorkoutModeExerciseItem[] = [
        {
            id: 'ex-1',
            exerciseId: 1,
            name: 'Bench Press',
            mode: 'strength',
            params: { sets: 3, reps: 8, restSeconds: 90 },
        },
    ]

    beforeEach(() => {
        jest.useFakeTimers()
        mockNavigate.mockReset()
        mockStartWorkoutSession.mockReset()
        mockMutateTemplate.mockReset()
        mockMarkClean.mockReset()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('repeat: starts via starter and navigates to active workout on success', async () => {
        mockStartWorkoutSession.mockResolvedValue({ id: 321 })
        const onRepeatError = jest.fn()

        const { result } = renderHook(() => useWorkoutModeHandlers({
            config,
            selectedPresetId: null,
            editorTitle: 'Силовая A',
            editorExercises,
            recentWorkout,
            validate: () => true,
            addExercise: jest.fn(),
            onAddSheetClose: jest.fn(),
            onRepeatError,
            onSaveAndStartError: jest.fn(),
        }))

        await act(async () => {
            await result.current.handleRepeat()
        })

        expect(onRepeatError).toHaveBeenCalledWith(null)
        expect(mockStartWorkoutSession).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('/workouts/active/321')
    })

    it('repeat: sets user-facing error when starter throws', async () => {
        mockStartWorkoutSession.mockRejectedValue(new Error('boom'))
        const onRepeatError = jest.fn()

        const { result } = renderHook(() => useWorkoutModeHandlers({
            config,
            selectedPresetId: null,
            editorTitle: 'Силовая A',
            editorExercises,
            recentWorkout,
            validate: () => true,
            addExercise: jest.fn(),
            onAddSheetClose: jest.fn(),
            onRepeatError,
            onSaveAndStartError: jest.fn(),
        }))

        await act(async () => {
            await result.current.handleRepeat()
        })

        expect(onRepeatError).toHaveBeenLastCalledWith('Не удалось повторить тренировку. Попробуйте ещё раз.')
    })

    it('save-and-start: sends patch payload with mapped exercises and navigates to active workout', async () => {
        mockStartWorkoutSession.mockResolvedValue({ id: 654 })
        const onSaveAndStartError = jest.fn()

        const { result } = renderHook(() => useWorkoutModeHandlers({
            config,
            selectedPresetId: null,
            editorTitle: 'Силовая B',
            editorExercises,
            recentWorkout: null,
            validate: () => true,
            addExercise: jest.fn(),
            onAddSheetClose: jest.fn(),
            onRepeatError: jest.fn(),
            onSaveAndStartError,
        }))

        await act(async () => {
            await result.current.handleSaveAndStart()
        })

        expect(onSaveAndStartError).toHaveBeenCalledWith(null)
        expect(mockStartWorkoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                startPayload: { name: 'Силовая B', type: 'strength' },
                draft: { title: 'Силовая B' },
                patchPayload: expect.objectContaining({
                    comments: 'Силовая B',
                    tags: ['strength'],
                    exercises: expect.any(Array),
                }),
            }),
        )

        act(() => {
            jest.runAllTimers()
        })

        expect(mockMarkClean).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('/workouts/active/654')
    })

    it('save-and-start: offline callback marks editor clean and redirects to workouts', async () => {
        mockStartWorkoutSession.mockImplementation(async (params: { onOfflineQueued?: () => void }) => {
            params.onOfflineQueued?.()
            return null
        })

        const { result } = renderHook(() => useWorkoutModeHandlers({
            config,
            selectedPresetId: null,
            editorTitle: 'Силовая C',
            editorExercises,
            recentWorkout: null,
            validate: () => true,
            addExercise: jest.fn(),
            onAddSheetClose: jest.fn(),
            onRepeatError: jest.fn(),
            onSaveAndStartError: jest.fn(),
        }))

        await act(async () => {
            await result.current.handleSaveAndStart()
        })

        act(() => {
            jest.runAllTimers()
        })

        expect(mockMarkClean).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('/workouts')
    })
})
