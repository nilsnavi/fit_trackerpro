import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { coachApi } from '../api/coachApi'
import type { CoachAssignmentStatus, CoachProfileInput } from '../types/coach'

export function useCoachProfile(enabled = true) {
    return useQuery({ queryKey: queryKeys.coach.profile, queryFn: coachApi.getProfile, enabled, retry: false })
}

export function useCreateCoachProfile() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: CoachProfileInput) => coachApi.createProfile(payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.profile }),
    })
}

export function useUpdateCoachProfile() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: Partial<CoachProfileInput>) => coachApi.updateProfile(payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.profile }),
    })
}

export function useCoachClients() {
    return useQuery({ queryKey: queryKeys.coach.clients, queryFn: coachApi.listClients, retry: false })
}

export function useCoachClient(clientId: number) {
    return useQuery({
        queryKey: queryKeys.coach.client(clientId),
        queryFn: () => coachApi.getClient(clientId),
        enabled: Number.isSafeInteger(clientId) && clientId > 0,
        retry: false,
    })
}

export function useCoachMonitoring(filters: import('../types/coach').MonitoringFilters = {}) {
    return useQuery({ queryKey: queryKeys.coach.monitoring.list(filters), queryFn: () => coachApi.getMonitoring(filters), retry: false })
}

export function useCoachMonitoringClient(clientId: number) {
    return useQuery({ queryKey: queryKeys.coach.monitoring.detail(clientId), queryFn: () => coachApi.getMonitoringClient(clientId), enabled: Number.isSafeInteger(clientId) && clientId > 0, retry: false })
}

export function useCoachPrograms() {
    return useQuery({ queryKey: queryKeys.coach.programs, queryFn: coachApi.listPrograms, retry: false })
}

export function useCoachProgram(programId: number) {
    return useQuery({
        queryKey: queryKeys.coach.program(programId), queryFn: () => coachApi.getProgram(programId),
        enabled: Number.isSafeInteger(programId) && programId > 0, retry: false,
    })
}

export function useCoachProgramAssignments(programId: number) {
    return useQuery({
        queryKey: queryKeys.coach.programAssignments(programId),
        queryFn: () => coachApi.listProgramAssignments(programId),
        enabled: Number.isSafeInteger(programId) && programId > 0, retry: false,
    })
}

export function useMyCoachPrograms() {
    return useQuery({ queryKey: queryKeys.coach.clientPrograms('self'), queryFn: coachApi.listMyPrograms, retry: false })
}

export function useCreateCoachProgram() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: coachApi.createProgram,
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.programs }),
    })
}

export function useCoachProgramAction(programId: number) {
    const qc = useQueryClient()
    const invalidate = async () => Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.coach.programs }),
        qc.invalidateQueries({ queryKey: queryKeys.coach.program(programId) }),
        qc.invalidateQueries({ queryKey: queryKeys.coach.programAssignments(programId) }),
        qc.invalidateQueries({ queryKey: queryKeys.coach.assignments }),
        qc.invalidateQueries({ queryKey: queryKeys.coach.root }),
    ])
    const activate = useMutation({ mutationFn: () => coachApi.activateProgram(programId), onSuccess: invalidate })
    const archive = useMutation({ mutationFn: () => coachApi.archiveProgram(programId), onSuccess: invalidate })
    const assign = useMutation({ mutationFn: (payload: { client_id: number; start_date?: string; coach_message?: string }) => coachApi.assignProgram(programId, payload), onSuccess: invalidate })
    return { activate, archive, assign }
}

export function useUpdateCoachAssignment(assignmentId: number, programId: number, clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: { status: CoachAssignmentStatus; client_message?: string }) => coachApi.updateAssignment(assignmentId, payload),
        onSuccess: async () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.coach.programAssignments(programId) }),
            qc.invalidateQueries({ queryKey: queryKeys.coach.clientPrograms(clientId) }),
            qc.invalidateQueries({ queryKey: queryKeys.coach.clientPrograms('self') }),
        ]),
    })
}

export function useUpdateCoachClient(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (status: import('../types/coach').RelationshipStatus) => coachApi.updateClient(clientId, { status }),
        onSuccess: async () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.coach.client(clientId) }),
            qc.invalidateQueries({ queryKey: queryKeys.coach.clients }),
        ]),
    })
}

export function useRevokeCoachClient(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => coachApi.revokeClient(clientId),
        onSuccess: async () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.coach.client(clientId) }),
            qc.invalidateQueries({ queryKey: queryKeys.coach.clients }),
        ]),
    })
}

export function useCoachInvitations() {
    return useQuery({ queryKey: queryKeys.coach.invitations, queryFn: coachApi.listInvitations, retry: false })
}

export function useCreateCoachInvitation() {
    const qc = useQueryClient()
    const mutation = useMutation({
        mutationFn: (payload?: { client_hint?: string | null }) => coachApi.createInvitation(payload),
        gcTime: 0,
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.invitations }),
    })
    return {
        ...mutation,
        create: async (payload?: { client_hint?: string | null }) => {
            const created = await mutation.mutateAsync(payload)
            mutation.reset()
            return created
        },
    }
}

export function useRevokeCoachInvitation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => coachApi.revokeInvitation(id),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.invitations }),
    })
}

/** Mutation cache is ephemeral and discarded immediately; the token is never a query key. */
export function useResolveCoachInvitation() {
    const mutation = useMutation({ mutationFn: (token: string) => coachApi.resolveInvitation(token), gcTime: 0 })
    return {
        ...mutation,
        resolve: async (token: string) => {
            try {
                return await mutation.mutateAsync(token)
            } finally {
                mutation.reset()
            }
        },
    }
}

export function useAcceptCoachInvitation() {
    const qc = useQueryClient()
    const mutation = useMutation({
        mutationFn: (token: string) => coachApi.acceptInvitation(token),
        gcTime: 0,
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.clients }),
    })
    return {
        ...mutation,
        accept: async (token: string) => {
            try {
                return await mutation.mutateAsync(token)
            } finally {
                mutation.reset()
            }
        },
    }
}
