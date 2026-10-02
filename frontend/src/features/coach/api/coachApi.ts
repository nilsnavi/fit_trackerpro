import { api } from '@shared/api/client'
import type {
    CoachClient,
    CoachClientDetail,
    CoachInvitation,
    CoachInvitationResolution,
    CoachProfile,
    CoachProfileInput,
    CreatedCoachInvitation,
    CoachProgram,
    CoachProgramAssignment,
    CoachProgramDayInput,
    CoachAssignmentStatus,
    ClientMonitoring,
    ClientMonitoringPage,
    MonitoringFilters,
} from '../types/coach'

const root = '/coach'

export type CoachSubscription = {
    plan: 'FREE' | 'TRAINER_PRO'; status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'CANCELLED' | 'EXPIRED'
    trial_started_at: string | null; trial_ends_at: string | null; trial_days_remaining: number | null
    grace_ends_at: string | null; grace_days_remaining: number | null; period_started_at: string | null; period_ends_at: string | null
    activated_at: string | null; cancelled_at: string | null
    cancel_at_period_end: boolean
    active_clients: { used: number; limit: number | null; remaining: number | null }
    active_programs: { used: number; limit: number | null; remaining: number | null }
    features: { client_monitoring: boolean; program_assignments: boolean; advanced_monitoring_filters: boolean }
    upgrade_required: boolean
}
export type CoachPlan = { plan: 'FREE' | 'TRAINER_PRO'; display_name: string; limits: { active_clients: number | null; active_programs: number | null }; available_features: CoachSubscription['features'] }

export const coachApi = {
    getSubscription: () => api.get<CoachSubscription>(`${root}/subscription`),
    listPlans: () => api.get<CoachPlan[]>(`${root}/plans`),
    getProfile: () => api.get<CoachProfile>(`${root}/profile`),
    createProfile: (payload: CoachProfileInput) => api.post<CoachProfile>(`${root}/profile`, payload),
    updateProfile: (payload: Partial<CoachProfileInput>) => api.patch<CoachProfile>(`${root}/profile`, payload),
    listInvitations: () => api.get<CoachInvitation[]>(`${root}/invitations`),
    createInvitation: (payload: { client_hint?: string | null } = {}) =>
        api.post<CreatedCoachInvitation>(`${root}/invitations`, payload),
    revokeInvitation: (id: string) => api.delete<void>(`${root}/invitations/${encodeURIComponent(id)}`),
    resolveInvitation: (token: string) =>
        api.post<CoachInvitationResolution>(`${root}/invitations/resolve`, { token }),
    acceptInvitation: (token: string) => api.post<CoachClient>(`${root}/invitations/accept`, { token }),
    listClients: () => api.get<CoachClient[]>(`${root}/clients`),
    getClient: (clientId: number) => api.get<CoachClientDetail>(`${root}/clients/${clientId}`),
    getMonitoring: (filters: MonitoringFilters = {}) => {
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
        return api.get<ClientMonitoringPage>(`${root}/monitoring${params.size ? `?${params.toString()}` : ''}`)
    },
    getMonitoringClient: (clientId: number) => api.get<ClientMonitoring>(`${root}/monitoring/${clientId}`),
    updateClient: (clientId: number, payload: { status: CoachClient['status'] }) =>
        api.patch<CoachClient>(`${root}/clients/${clientId}`, payload),
    revokeClient: (clientId: number) => api.delete<void>(`${root}/clients/${clientId}`),
    listPrograms: () => api.get<CoachProgram[]>(`${root}/programs`),
    getProgram: (programId: number) => api.get<CoachProgram>(`${root}/programs/${programId}`),
    createProgram: (payload: { name: string; description?: string | null; days: CoachProgramDayInput[] }) =>
        api.post<CoachProgram>(`${root}/programs`, payload),
    updateProgram: (programId: number, payload: { name?: string; description?: string | null }) =>
        api.patch<CoachProgram>(`${root}/programs/${programId}`, payload),
    createProgramDay: (programId: number, payload: CoachProgramDayInput) =>
        api.post<CoachProgram>(`${root}/programs/${programId}/days`, payload),
    updateProgramDay: (programId: number, dayId: number, payload: Partial<CoachProgramDayInput>) =>
        api.patch<CoachProgram>(`${root}/programs/${programId}/days/${dayId}`, payload),
    deleteProgramDay: (programId: number, dayId: number) =>
        api.delete<void>(`${root}/programs/${programId}/days/${dayId}`),
    activateProgram: (programId: number) => api.post<CoachProgram>(`${root}/programs/${programId}/activate`, {}),
    archiveProgram: (programId: number) => api.delete<CoachProgram>(`${root}/programs/${programId}`),
    assignProgram: (programId: number, payload: { client_id: number; start_date?: string; coach_message?: string }) =>
        api.post<CoachProgramAssignment>(`${root}/programs/${programId}/assignments`, payload),
    listProgramAssignments: (programId: number) =>
        api.get<CoachProgramAssignment[]>(`${root}/programs/${programId}/assignments`),
    listClientPrograms: (clientId: number) => api.get<CoachProgramAssignment[]>(`${root}/clients/${clientId}/programs`),
    updateAssignment: (assignmentId: number, payload: { status: CoachAssignmentStatus; client_message?: string }) =>
        api.patch<CoachProgramAssignment>(`${root}/assignments/${assignmentId}`, payload),
    listMyPrograms: () => api.get<CoachProgramAssignment[]>('/client/coach-programs'),
    startProgramDay: (assignmentId: number, dayId: number, idempotencyKey: string) =>
        api.post<{
            assignment_id: number; program_id: number; program_version: number;
            program_day_id: number; workout_template_id: number; workout_session_id: number;
            source_type: string; source_metadata: Record<string, number>
        }>(`/client/coach-programs/${assignmentId}/days/${dayId}/start`, {}, {
            headers: { 'Idempotency-Key': idempotencyKey },
        }),
}
