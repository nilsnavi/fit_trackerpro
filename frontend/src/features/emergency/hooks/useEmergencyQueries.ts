import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import {
    emergencyApi,
    type EmergencyLogPayload,
    type EmergencyNotifyPayload,
} from '@features/emergency/api/emergencyApi'

export function useEmergencyContactsQuery(enabled: boolean) {
    return useQuery({
        queryKey: queryKeys.emergency.contacts,
        queryFn: () => emergencyApi.getContacts(),
        enabled,
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
