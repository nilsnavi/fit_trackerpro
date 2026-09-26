import { buildContactUpdatePayload, contactToFormValues, normalizeUsername } from '../contactForm'
import type { EmergencyContact } from '@features/emergency/api/emergencyApi'

const base: EmergencyContact = {
    id: 7,
    user_id: 1,
    contact_name: 'Мама',
    contact_username: 'mama',
    phone: null,
    relationship_type: null,
    is_active: true,
    notify_on_emergency: true,
    notify_on_workout_start: false,
    notify_on_workout_end: false,
    priority: 1,
    is_linked: true,
    linked_at: null,
}

describe('contactForm helpers', () => {
    it('strips leading @ signs from usernames', () => {
        expect(normalizeUsername('  @@papa ')).toBe('papa')
    })

    it('produces an empty payload when nothing changed', () => {
        expect(buildContactUpdatePayload(base, contactToFormValues(base))).toEqual({})
    })

    it('clears a channel with null and trims values', () => {
        const values = {
            ...contactToFormValues(base),
            contact_name: '  Мамуля ',
            contact_username: '',
            phone: ' +7999 ',
            is_active: false,
        }
        expect(buildContactUpdatePayload(base, values)).toEqual({
            contact_name: 'Мамуля',
            contact_username: null,
            phone: '+7999',
            is_active: false,
        })
    })

    it('treats "@mama" as the same username', () => {
        const values = { ...contactToFormValues(base), contact_username: '@mama' }
        expect(buildContactUpdatePayload(base, values)).toEqual({})
    })
})
