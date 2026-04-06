export const WORKOUT_SESSION_DRAFT_CLOUD_KEY = 'fitpro_workout_session_draft_v1'

export interface WorkoutSessionDraftBlob {
    workoutId: number
    templateId?: number | null
    title: string
    updatedAt: number
}

export function parseWorkoutSessionDraftBlob(raw: string | null): WorkoutSessionDraftBlob | null {
    if (!raw) return null
    try {
        const o = JSON.parse(raw) as unknown
        if (!o || typeof o !== 'object') return null
        const w = o as Record<string, unknown>
        const idRaw = w.workoutId
        const workoutId = typeof idRaw === 'number' ? idRaw : Number(idRaw)
        if (!Number.isFinite(workoutId)) return null
        const templateIdRaw = w.templateId
        const templateId =
            templateIdRaw == null
                ? null
                : (typeof templateIdRaw === 'number' ? templateIdRaw : Number(templateIdRaw))
        const normalizedTemplateId = Number.isFinite(templateId) ? templateId : null
        const title = typeof w.title === 'string' ? w.title : ''
        const updatedAt = typeof w.updatedAt === 'number' ? w.updatedAt : 0
        return { workoutId, templateId: normalizedTemplateId, title, updatedAt }
    } catch {
        return null
    }
}
