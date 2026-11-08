import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { coachApi } from '../api/coachApi'
import type {
    CoachAssignmentStatus,
    CoachClientPackageInput,
    CoachPackageInput,
    CoachPackagePatch,
    CoachPaymentInput,
    CoachProfileInput,
    CoachTaskInput,
    CoachTaskPatch,
} from '../types/coach'

export function useCoachProfile(enabled = true) {
    return useQuery({ queryKey: queryKeys.coach.profile, queryFn: coachApi.getProfile, enabled, retry: false })
}

export function useCoachSubscription() {
    return useQuery({ queryKey: queryKeys.coachSubscription.current, queryFn: coachApi.getSubscription, retry: false, staleTime: 0 })
}

export function useCoachPlans() {
    return useQuery({ queryKey: queryKeys.coachSubscription.plans, queryFn: coachApi.listPlans, retry: false })
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

export function useCoachMonitoring(filters: Omit<import('../types/coach').MonitoringFilters, 'offset' | 'limit'> = {}) {
    const limit = 50
    return useInfiniteQuery({
        queryKey: queryKeys.coach.monitoring.list({ ...filters, limit }),
        initialPageParam: 0,
        queryFn: ({ pageParam }) => coachApi.getMonitoring({ ...filters, limit, offset: pageParam }),
        getNextPageParam: (lastPage, pages) => {
            const loaded = pages.reduce((count, page) => count + page.items.length, 0)
            return loaded < lastPage.total ? loaded : undefined
        },
        retry: false,
    })
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
        onSuccess: async () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.coach.programs }),
            qc.invalidateQueries({ queryKey: queryKeys.coachSubscription.current }),
        ]),
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
        qc.invalidateQueries({ queryKey: queryKeys.coachSubscription.current }),
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
            qc.invalidateQueries({ queryKey: queryKeys.coachSubscription.current }),
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
            qc.invalidateQueries({ queryKey: queryKeys.coachSubscription.current }),
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

// --- Sprint 10.4: packages, payments, tasks ---

export function useCoachPackages(includeArchived = false) {
    return useQuery({
        queryKey: queryKeys.coach.packages.list(includeArchived),
        queryFn: () => coachApi.listPackages(includeArchived),
        retry: false,
    })
}

export function useCreateCoachPackage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: CoachPackageInput) => coachApi.createPackage(payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.packages.all }),
    })
}

export function useUpdateCoachPackage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ packageId, payload }: { packageId: number; payload: CoachPackagePatch }) =>
            coachApi.updatePackage(packageId, payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.packages.all }),
    })
}

export function useArchiveCoachPackage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (packageId: number) => coachApi.archivePackage(packageId),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.packages.all }),
    })
}

export function useCoachClientPackages(clientId: number) {
    return useQuery({
        queryKey: queryKeys.coach.clientPackages(clientId),
        queryFn: () => coachApi.listClientPackages(clientId),
        enabled: Number.isSafeInteger(clientId) && clientId > 0,
        retry: false,
    })
}

export function useCoachClientPackage(clientId: number, packageId: number) {
    return useQuery({
        queryKey: queryKeys.coach.clientPackage(clientId, packageId),
        queryFn: () => coachApi.getClientPackage(clientId, packageId),
        enabled: Number.isSafeInteger(clientId) && clientId > 0 && Number.isSafeInteger(packageId) && packageId > 0,
        retry: false,
    })
}

export function useAssignCoachClientPackage(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: CoachClientPackageInput) => coachApi.assignClientPackage(clientId, payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.clientPackages(clientId) }),
    })
}

export function useConsumeCoachClientPackage(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ packageId, idempotencyKey }: { packageId: number; idempotencyKey: string }) =>
            coachApi.consumeClientPackage(clientId, packageId, idempotencyKey),
        onSuccess: async () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.coach.clientPackages(clientId) }),
            qc.invalidateQueries({ queryKey: queryKeys.coach.client(clientId) }),
        ]),
    })
}

export function useReverseCoachClientPackage(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (packageId: number) => coachApi.reverseClientPackage(clientId, packageId),
        onSuccess: async () => Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.coach.clientPackages(clientId) }),
            qc.invalidateQueries({ queryKey: queryKeys.coach.client(clientId) }),
        ]),
    })
}

export function useCoachClientPayments(clientId: number) {
    return useQuery({
        queryKey: queryKeys.coach.payments(clientId),
        queryFn: () => coachApi.listClientPayments(clientId),
        enabled: Number.isSafeInteger(clientId) && clientId > 0,
        retry: false,
    })
}

export function useRecordCoachClientPayment(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: CoachPaymentInput) => coachApi.recordClientPayment(clientId, payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.payments(clientId) }),
    })
}

export function useReverseCoachClientPayment(clientId: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (paymentId: number) => coachApi.reverseClientPayment(clientId, paymentId),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.payments(clientId) }),
    })
}

export function useCoachTasks(filters: { client_id?: number; completed?: boolean; due_today?: boolean } = {}) {
    return useQuery({
        queryKey: queryKeys.coach.tasks(filters),
        queryFn: () => coachApi.listTasks(filters),
        retry: false,
    })
}

export function useCreateCoachTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: CoachTaskInput) => coachApi.createTask(payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: queryKeys.coach.tasks({}) }),
    })
}

export function useUpdateCoachTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ taskId, payload }: { taskId: number; payload: CoachTaskPatch }) =>
            coachApi.updateTask(taskId, payload),
        onSuccess: async () => qc.invalidateQueries({ queryKey: ['coach', 'tasks'] }),
    })
}

export function useCompleteCoachTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (taskId: number) => coachApi.completeTask(taskId),
        onSuccess: async () => qc.invalidateQueries({ queryKey: ['coach', 'tasks'] }),
    })
}

export function useDeleteCoachTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (taskId: number) => coachApi.deleteTask(taskId),
        onSuccess: async () => qc.invalidateQueries({ queryKey: ['coach', 'tasks'] }),
    })
}
