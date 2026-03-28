import { api } from '@shared/api/client'

export type EmergencySymptom = 'hypoglycemia' | 'dizziness' | 'pain' | 'other'

export interface EmergencyContact {
    id: number
    contact_name: string
    contact_username?: string
    phone?: string
    relationship_type?: string
}

export interface EmergencyContactsResponse {
    items: EmergencyContact[]
    active_count: number
}

export interface EmergencyLogPayload {
    symptom: EmergencySymptom
    timestamp: string
    protocolStarted: boolean
    contactNotified: boolean
    location?: string
}

export interface EmergencyNotifyPayload {
    message: string
    location?: string
    severity: string
}

export const emergencyApi = {
    getContacts(): Promise<EmergencyContactsResponse> {
        return api.get<EmergencyContactsResponse>('/emergency/contact')
    },
    postLog(payload: EmergencyLogPayload): Promise<void> {
        return api.post('/emergency/log', payload)
    },
    postNotify(payload: EmergencyNotifyPayload): Promise<void> {
        return api.post('/emergency/notify', payload)
    },
}
