import { api } from '@shared/api/client'

export type EmergencySymptom = 'hypoglycemia' | 'dizziness' | 'pain' | 'other'

export interface EmergencyContact {
    id: number
    user_id: number
    contact_name: string
    contact_username?: string | null
    phone?: string | null
    relationship_type?: string | null
    is_active: boolean
    notify_on_workout_start: boolean
    notify_on_workout_end: boolean
    notify_on_emergency: boolean
    priority: number
    /** Контакт подтвердил подключение в боте — только им реально уходит уведомление. */
    is_linked: boolean
    linked_at?: string | null
}

export interface EmergencyContactsResponse {
    items: EmergencyContact[]
    total: number
    active_count: number
}

export interface EmergencyContactCreatePayload {
    contact_name: string
    contact_username?: string
    phone?: string
    relationship_type?: string
    notify_on_emergency?: boolean
    notify_on_workout_start?: boolean
    notify_on_workout_end?: boolean
}

export interface EmergencyContactLink {
    contact_id: number
    contact_name: string
    code: string
    command: string
    deep_link?: string | null
    is_linked: boolean
}

export interface EmergencyNotificationResult {
    contact_id: number
    contact_name: string
    method: string
    success: boolean
    error?: string | null
}

export interface EmergencyNotifyResponse {
    notified_at: string
    severity: string
    message_sent: string
    results: EmergencyNotificationResult[]
    successful_count: number
    failed_count: number
}

export interface EmergencyLogPayload {
    symptom: EmergencySymptom
    timestamp: string
    protocolStarted: boolean
    contactNotified: boolean
    location?: string
}

export interface EmergencyNotifyPayload {
    message?: string
    location?: string
    severity?: string
}

const BASE = '/system/emergency'

export const emergencyApi = {
    getContacts(): Promise<EmergencyContactsResponse> {
        return api.get<EmergencyContactsResponse>(`${BASE}/contact`)
    },
    createContact(payload: EmergencyContactCreatePayload): Promise<EmergencyContact> {
        return api.post<EmergencyContact>(`${BASE}/contact`, payload)
    },
    deleteContact(contactId: number): Promise<void> {
        return api.delete(`${BASE}/contact/${contactId}`)
    },
    /** Invite code the contact sends to the bot to become reachable. */
    issueLinkCode(contactId: number): Promise<EmergencyContactLink> {
        return api.post<EmergencyContactLink>(`${BASE}/contact/${contactId}/link-code`)
    },
    unlinkContact(contactId: number): Promise<EmergencyContact> {
        return api.delete<EmergencyContact>(`${BASE}/contact/${contactId}/link`)
    },
    postLog(payload: EmergencyLogPayload): Promise<void> {
        return api.post(`${BASE}/log`, payload)
    },
    /** Real alert: the response reports delivery per contact, never a blanket success. */
    postNotify(payload: EmergencyNotifyPayload): Promise<EmergencyNotifyResponse> {
        return api.post<EmergencyNotifyResponse>(`${BASE}/notify`, payload)
    },
}
