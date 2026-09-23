import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import {
    emergencyApi,
    type EmergencyContactCreatePayload,
    type EmergencyLogPayload,
    type EmergencyNotifyPayload,
} from '@features/emergency/api/emergencyApi'

export function useEmergencyContactsQuery(enabled = true) {
    return useQuery({
        queryKey: queryKeys.emergency.contacts,
        queryFn: () => emergencyApi.getContacts(),
        enabled,
    })
}

export function useCreateEmergencyContactMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: EmergencyContactCreatePayload) => emergencyApi.createContact(payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.emergency.contacts })
        },
    })
}

export function useDeleteEmergencyContactMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (contactId: number) => emergencyApi.deleteContact(contactId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.emergency.contacts })
        },
    })
}

export function useIssueEmergencyLinkCodeMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (contactId: number) => emergencyApi.issueLinkCode(contactId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.emergency.contacts })
        },
    })
}

export function useUnlinkEmergencyContactMutation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (contactId: number) => emergencyApi.unlinkContact(contactId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.emergency.contacts })
        },
    })
}

export function useEmergencyLogMutation() {
    return useMutation({
        mutationFn: (payload: EmergencyLogPayload) => emergencyApi.postLog(payload),
    })
}

export function useEmergencyNotifyMutation() {
    return useMutation({
        mutationFn: (payload: EmergencyNotifyPayload) => emergencyApi.postNotify(payload),
    })
}
