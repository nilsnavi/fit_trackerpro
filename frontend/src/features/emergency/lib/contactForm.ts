/** Чистые помощники формы экстренного контакта (без React — тестируются отдельно). */
import type {
    EmergencyContact,
    EmergencyContactUpdatePayload,
} from '@features/emergency/api/emergencyApi'

export interface EmergencyContactFormValues {
    contact_name: string
    contact_username: string
    phone: string
    notify_on_emergency: boolean
    notify_on_workout_start: boolean
    notify_on_workout_end: boolean
    is_active: boolean
}

/** Значения по умолчанию совпадают с backend `EmergencyContactCreate`. */
export const EMPTY_CONTACT_FORM: EmergencyContactFormValues = {
    contact_name: '',
    contact_username: '',
    phone: '',
    notify_on_emergency: true,
    notify_on_workout_start: false,
    notify_on_workout_end: false,
    is_active: true,
}

export function normalizeUsername(value: string): string {
    return value.trim().replace(/^@+/, '')
}

export function contactToFormValues(contact: EmergencyContact): EmergencyContactFormValues {
    return {
        contact_name: contact.contact_name,
        contact_username: contact.contact_username ?? '',
        phone: contact.phone ?? '',
        notify_on_emergency: contact.notify_on_emergency,
        notify_on_workout_start: contact.notify_on_workout_start,
        notify_on_workout_end: contact.notify_on_workout_end,
        is_active: contact.is_active,
    }
}

/** Только изменённые поля; пустой username/телефон отправляется как `null` (очистка). */
export function buildContactUpdatePayload(
    contact: EmergencyContact,
    values: EmergencyContactFormValues,
): EmergencyContactUpdatePayload {
    const payload: EmergencyContactUpdatePayload = {}
    const name = values.contact_name.trim()
    const username = normalizeUsername(values.contact_username) || null
    const phone = values.phone.trim() || null

    if (name !== contact.contact_name) payload.contact_name = name
    if (username !== (contact.contact_username ?? null)) payload.contact_username = username
    if (phone !== (contact.phone ?? null)) payload.phone = phone
    if (values.notify_on_emergency !== contact.notify_on_emergency) {
        payload.notify_on_emergency = values.notify_on_emergency
    }
    if (values.notify_on_workout_start !== contact.notify_on_workout_start) {
        payload.notify_on_workout_start = values.notify_on_workout_start
    }
    if (values.notify_on_workout_end !== contact.notify_on_workout_end) {
        payload.notify_on_workout_end = values.notify_on_workout_end
    }
    if (values.is_active !== contact.is_active) payload.is_active = values.is_active
    return payload
}

export function describeSubscriptions(contact: EmergencyContact): string {
    if (!contact.is_active) return 'неактивен — уведомления выключены'
    const parts: string[] = []
    if (contact.notify_on_emergency) parts.push('«Мне плохо»')
    if (contact.notify_on_workout_start) parts.push('начало')
    if (contact.notify_on_workout_end) parts.push('окончание')
    return parts.length > 0 ? `Уведомляем: ${parts.join(', ')}` : 'Уведомления выключены'
}
