/** Значения `kind` для исполнителя очереди (workouts API). */
export const WORKOUT_SYNC_KINDS = {
    TEMPLATE_CREATE: 'workout.template.create',
    TEMPLATE_UPDATE: 'workout.template.update',
    START: 'workout.start',
    SESSION_UPDATE: 'workout.session.update',
    SESSION_COMPLETE: 'workout.session.complete',
    COMPLETE: 'workout.complete',
} as const

export type WorkoutSyncKind = (typeof WORKOUT_SYNC_KINDS)[keyof typeof WORKOUT_SYNC_KINDS]
