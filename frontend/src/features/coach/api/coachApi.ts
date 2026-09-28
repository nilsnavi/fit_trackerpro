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
} from '../types/coach'

const root = '/coach'

export const coachApi = {
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
