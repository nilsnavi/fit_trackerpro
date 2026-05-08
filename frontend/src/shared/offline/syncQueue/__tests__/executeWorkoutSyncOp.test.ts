import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { executeWorkoutSyncOp } from '../executeWorkoutSyncOp'
import { WORKOUT_SYNC_KINDS } from '../workoutKinds'

jest.mock('@shared/api/domains/workoutsApi', () => ({
    workoutsApi: {
        createTemplate: jest.fn(),
        updateTemplate: jest.fn(),
        startWorkout: jest.fn(),
        updateWorkoutSession: jest.fn(),
        completeWorkout: jest.fn(),
    },
}))

const mockedWorkoutsApi = workoutsApi as jest.Mocked<typeof workoutsApi>

describe('executeWorkoutSyncOp', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('executes legacy active-session update queue items', async () => {
        mockedWorkoutsApi.updateWorkoutSession.mockResolvedValue({} as never)

        await executeWorkoutSyncOp('WORKOUT_SESSION_UPDATE', {
            workoutId: 11,
            body: { exercises: [], comments: 'desktop cache', tags: [] },
        })

        expect(mockedWorkoutsApi.updateWorkoutSession).toHaveBeenCalledWith(11, {
            exercises: [],
            comments: 'desktop cache',
            tags: [],
        })
    })

    it('executes legacy active-session complete queue items', async () => {
        mockedWorkoutsApi.completeWorkout.mockResolvedValue({} as never)

        await executeWorkoutSyncOp('WORKOUT_SESSION_COMPLETE', {
            workoutId: 11,
            body: { exercises: [], comments: '', tags: [] },
        })

        expect(mockedWorkoutsApi.completeWorkout).toHaveBeenCalledWith(11, {
            exercises: [],
            comments: '',
            tags: [],
        })
    })

    it('executes session complete alias queue items', async () => {
        mockedWorkoutsApi.completeWorkout.mockResolvedValue({} as never)

        await executeWorkoutSyncOp(WORKOUT_SYNC_KINDS.SESSION_COMPLETE, {
            workoutId: 12,
            body: { exercises: [], comments: '', tags: [] },
        })

        expect(mockedWorkoutsApi.completeWorkout).toHaveBeenCalledWith(12, {
            exercises: [],
            comments: '',
            tags: [],
        })
    })
})
