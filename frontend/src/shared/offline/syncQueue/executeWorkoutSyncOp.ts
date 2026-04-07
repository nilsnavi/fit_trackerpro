import { workoutsApi } from '@shared/api/domains/workoutsApi'
import type {
    WorkoutCompleteRequest,
    WorkoutStartRequest,
    WorkoutSessionUpdateRequest,
    WorkoutTemplateCreateRequest,
} from '@features/workouts/types/workouts'
import { WORKOUT_SYNC_KINDS } from './workoutKinds'

export async function executeWorkoutSyncOp(kind: string, payload: unknown): Promise<void> {
    switch (kind) {
        case WORKOUT_SYNC_KINDS.TEMPLATE_CREATE: {
            const p = payload as WorkoutTemplateCreateRequest
            await workoutsApi.createTemplate(p)
            return
        }
        case WORKOUT_SYNC_KINDS.TEMPLATE_UPDATE: {
            const { templateId, body } = payload as {
                templateId: number
                body: WorkoutTemplateCreateRequest
            }
            await workoutsApi.updateTemplate(templateId, body)
            return
        }
        case WORKOUT_SYNC_KINDS.START: {
            const p = payload as WorkoutStartRequest
            await workoutsApi.startWorkout(p)
            return
        }
        case WORKOUT_SYNC_KINDS.SESSION_UPDATE: {
            const { workoutId, body } = payload as {
                workoutId: number
                body: WorkoutSessionUpdateRequest
            }
            await workoutsApi.updateWorkoutSession(workoutId, body)
            return
        }
        case WORKOUT_SYNC_KINDS.COMPLETE: {
            const { workoutId, body } = payload as {
                workoutId: number
                body: WorkoutCompleteRequest
            }
            await workoutsApi.completeWorkout(workoutId, body)
            return
        }
        default:
            throw new Error(`Unknown sync queue kind: ${kind}`)
    }
}
