import { api } from '@shared/api/client'
import { coachApi } from './coachApi'

jest.mock('@shared/api/client', () => ({
    api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}))

describe('coachApi', () => {
    beforeEach(() => jest.clearAllMocks())

    it('uses the shared API client and Coach endpoint paths/payloads', async () => {
        await coachApi.createProfile({ display_name: 'Coach', specializations: ['strength'] })
        expect(api.post).toHaveBeenCalledWith('/coach/profile', { display_name: 'Coach', specializations: ['strength'] })
        await coachApi.updateClient(22, { status: 'PAUSED' })
        expect(api.patch).toHaveBeenCalledWith('/coach/clients/22', { status: 'PAUSED' })
        await coachApi.revokeInvitation('id-1')
        expect(api.delete).toHaveBeenCalledWith('/coach/invitations/id-1')
    })

    it('sends invitation token in resolve/accept request bodies, not URLs', async () => {
        const token = 'secret-in-memory-token'
        await coachApi.resolveInvitation(token)
        expect(api.post).toHaveBeenCalledWith('/coach/invitations/resolve', { token })
        await coachApi.acceptInvitation(token)
        expect(api.post).toHaveBeenCalledWith('/coach/invitations/accept', { token })
    })
})
