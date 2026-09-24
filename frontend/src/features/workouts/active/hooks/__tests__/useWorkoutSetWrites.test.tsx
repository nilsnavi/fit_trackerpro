import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

import { AppHttpError } from '@shared/errors'
import type { CompletedExercise, WorkoutSetResponse } from '@features/workouts/types/workouts'
import { useWorkoutSessionUiStore } from '@/state/local'
import { serverSetPatch, useWorkoutSetWrites } from '../useWorkoutSetWrites'

jest.mock('@shared/api/domains/workoutsApi', () => ({
    workoutsApi: {
        patchWorkoutSet: jest.fn(),
        getWeightRecommendation: jest.fn(),
    },
}))

jest.mock('@shared/offline/workoutOfflineEnqueue', () => ({
    enqueueOfflineWorkoutSetUpdate: jest.fn(),
}))

jest.mock('@shared/stores/toastStore', () => ({
    toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() },
}))

const WORKOUT_ID = 7

// Клиенты создаются внутри теста, а их gc-таймеры живут дольше: чистим явно.
const queryClients: QueryClient[] = []

afterEach(() => {
    queryClients.forEach((client) => client.clear())
    queryClients.length = 0
})

function makeExercise(): CompletedExercise {
    return {
        exercise_id: 42,
        name: 'Жим лёжа',
        sets_completed: [
            { id: 1, set_number: 1, set_type: 'working', weight: 60, reps: 8, completed: false, planned_rest_seconds: 120 },
            { id: 2, set_number: 2, set_type: 'working', weight: 60, reps: 8, completed: false },
        ],
    }
}

function makeServerSet(overrides: Partial<WorkoutSetResponse> = {}): WorkoutSetResponse {
    return {
        id: 1,
        workout_id: WORKOUT_ID,
        exercise_id: 42,
        set_number: 1,
        reps: 8,
        weight: 60,
        completed: true,
        ...overrides,
    }
}

function renderSetWrites(exercise: CompletedExercise = makeExercise()) {
    const { workoutsApi } = jest.requireMock('@shared/api/domains/workoutsApi') as {
        workoutsApi: { patchWorkoutSet: jest.Mock; getWeightRecommendation: jest.Mock }
    }
    const { enqueueOfflineWorkoutSetUpdate } = jest.requireMock('@shared/offline/workoutOfflineEnqueue') as {
        enqueueOfflineWorkoutSetUpdate: jest.Mock
    }

    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    queryClients.push(queryClient)
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
    const callbacks = {
        onUpdateSet: jest.fn(),
        onSetLastCompletedSet: jest.fn(),
        onSetCurrentPosition: jest.fn(),
        onSelectExercise: jest.fn(),
        onNotifySetCompleted: jest.fn(),
        onCompletionError: jest.fn(),
    }

    const view = renderHook(
        () =>
            useWorkoutSetWrites({
                workoutId: WORKOUT_ID,
                exercise,
                exerciseIndex: 0,
                exercises: [exercise],
                ...callbacks,
            }),
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            ),
        },
    )

    return {
        ...view,
        ...callbacks,
        exercise,
        invalidateQueries,
        patchWorkoutSet: workoutsApi.patchWorkoutSet,
        getWeightRecommendation: workoutsApi.getWeightRecommendation,
        enqueueOfflineWorkoutSetUpdate,
    }
}

describe('useWorkoutSetWrites', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        useWorkoutSessionUiStore.setState({ sessionRestTimer: null })
    })

    it('завершает подход локально, не дожидаясь сети', async () => {
        const harness = renderSetWrites()
        // Сеть отвечает бесконечно долго: всё локальное обязано случиться само.
        harness.patchWorkoutSet.mockReturnValue(new Promise(() => undefined))

        await act(async () => {
            void harness.result.current.completeSet(harness.exercise.sets_completed[0])
        })

        expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 1, {
            completed: true,
            completed_at: expect.any(String),
        })
        expect(harness.onSetLastCompletedSet).toHaveBeenCalledWith({ exerciseIndex: 0, setNumber: 1 })
        // SPEC-005 §11: следующий подход предзаполнен из завершённого.
        expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 2, { weight: 60, reps: 8 })
        expect(harness.onSetCurrentPosition).toHaveBeenCalledWith(0, 1)
        expect(harness.onNotifySetCompleted).toHaveBeenCalled()

        // SPEC-005 §17: отдых стартует от плана подхода.
        const rest = useWorkoutSessionUiStore.getState().sessionRestTimer
        expect(rest).toMatchObject({ active: true, total: 120, nextSetOrdinal: 2, exerciseName: 'Жим лёжа' })
    })

    it('сливает только серверные поля и не откатывает completed ответом-эхом', async () => {
        const harness = renderSetWrites()
        // Ответ относится к запросу, отправленному раньше локальной правки: `completed: false`.
        harness.patchWorkoutSet.mockResolvedValue({ ...makeServerSet({ weight: 62.5 }), completed: false })
        harness.getWeightRecommendation.mockResolvedValue({ recommendation: 'increase', message: 'ok', suggested_weight: 65 })

        await act(async () => {
            await harness.result.current.completeSet(harness.exercise.sets_completed[0])
        })

        const calls = harness.onUpdateSet.mock.calls
        const merge = calls.find(([, setNumber, patch]) => setNumber === 1 && 'id' in patch)
        expect(merge?.[2]).not.toHaveProperty('completed')
        expect(merge?.[2]).toMatchObject({ id: 1, weight: 62.5, reps: 8 })

        // Свежая рекомендация подставлена следующему подходу тем же владельцем.
        await waitFor(() => {
            expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 2, { weight: 65 })
        })
    })

    it('ставит запись подхода в офлайн-очередь и оставляет рядок завершённым', async () => {
        const harness = renderSetWrites()
        harness.patchWorkoutSet.mockRejectedValue(
            new AppHttpError({ status: null, code: 'NETWORK_ERROR', message: 'no connection' }),
        )

        await act(async () => {
            await harness.result.current.completeSet(harness.exercise.sets_completed[0])
        })

        expect(harness.enqueueOfflineWorkoutSetUpdate).toHaveBeenCalledWith(WORKOUT_ID, 1, {
            weight: 60,
            reps: 8,
            completed: true,
        })
        // Рядок уже завершён локально: откатывать его нечем и не нужно.
        expect(harness.onUpdateSet.mock.calls.filter(([, , patch]) => patch.completed === false)).toHaveLength(0)
    })

    it('не пишет и не отправляет подход, который не прошёл проверки', async () => {
        const exercise = makeExercise()
        exercise.sets_completed[0] = { ...exercise.sets_completed[0], weight: undefined }
        const harness = renderSetWrites(exercise)

        await act(async () => {
            await harness.result.current.completeSet(exercise.sets_completed[0])
        })

        expect(harness.onCompletionError).toHaveBeenCalledWith('Заполните вес больше 0')
        expect(harness.onUpdateSet).not.toHaveBeenCalled()
        expect(harness.patchWorkoutSet).not.toHaveBeenCalled()
    })

    it('разрешает пустой вес у разминочного подхода', async () => {
        const exercise = makeExercise()
        exercise.sets_completed[0] = { ...exercise.sets_completed[0], set_type: 'warmup', weight: undefined }
        const harness = renderSetWrites(exercise)
        harness.patchWorkoutSet.mockResolvedValue(makeServerSet({ weight: null }))

        await act(async () => {
            await harness.result.current.completeSet(exercise.sets_completed[0])
        })

        expect(harness.onCompletionError).toHaveBeenCalledWith(null)
        expect(harness.patchWorkoutSet).toHaveBeenCalledWith(WORKOUT_ID, 1, { weight: 0, reps: 8, completed: true })
    })

    it('отправляет RPE завершённого подхода и обновляет рекомендацию', async () => {
        const harness = renderSetWrites()
        const completedSet = { ...harness.exercise.sets_completed[0], completed: true }
        harness.patchWorkoutSet.mockResolvedValue(makeServerSet({ rpe: 9 }))
        harness.getWeightRecommendation.mockResolvedValue({ recommendation: 'decrease', message: 'ok', suggested_weight: 55 })

        await act(async () => {
            harness.result.current.updateSetRpe(completedSet, 9)
        })

        expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 1, { rpe: 9 })
        expect(harness.patchWorkoutSet).toHaveBeenCalledWith(WORKOUT_ID, 1, { rpe: 9 })
        await waitFor(() => {
            expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 2, { weight: 55 })
        })
    })

    it('правит RPE незавершённого подхода только локально и сбрасывает кэш рекомендации', async () => {
        const harness = renderSetWrites()

        await act(async () => {
            harness.result.current.updateSetRpe(harness.exercise.sets_completed[0], 8.5)
        })

        expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 1, { rpe: 8.5 })
        expect(harness.patchWorkoutSet).not.toHaveBeenCalled()
        expect(harness.invalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('не ломает правку RPE, когда сервер отказал', async () => {
        const harness = renderSetWrites()
        const completedSet = { ...harness.exercise.sets_completed[0], completed: true }
        harness.patchWorkoutSet.mockRejectedValue(
            new AppHttpError({ status: 500, code: 'SERVER_ERROR', message: 'boom' }),
        )

        await act(async () => {
            harness.result.current.updateSetRpe(completedSet, 9)
        })

        await waitFor(() => {
            expect(harness.patchWorkoutSet).toHaveBeenCalledTimes(1)
        })
        // Локальная правка осталась, запрос рекомендации не требуется.
        expect(harness.onUpdateSet).toHaveBeenCalledWith(0, 1, { rpe: 9 })
        expect(harness.getWeightRecommendation).not.toHaveBeenCalled()
    })

    it('serverSetPatch не переносит completed и подставляет локальные значения как fallback', () => {
        const patch = serverSetPatch(makeServerSet({ completed: true, duration: null, weight: null }), {
            weight: 55,
            duration: 90,
        })

        expect(patch).not.toHaveProperty('completed')
        expect(patch).toMatchObject({ id: 1, weight: 55, duration: 90 })
    })
})
