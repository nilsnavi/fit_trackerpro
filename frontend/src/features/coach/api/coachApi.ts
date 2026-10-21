import { api } from '@shared/api/client'
import type {
    CoachClient,
    CoachClientDetail,
    CoachInvitation,
    CoachInvitationResolution,
    CoachProfile,
    CoachProfileInput,
    CreatedCoachInvitation,
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
}
