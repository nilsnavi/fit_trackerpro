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

describe('coachApi business (Sprint 10.4)', () => {
    beforeEach(() => jest.clearAllMocks())

    it('targets packages, payments, and tasks endpoints with correct payloads', async () => {
        await coachApi.listPackages(true)
        expect(api.get).toHaveBeenCalledWith('/coach/packages', { include_archived: true })
        await coachApi.createPackage({ name: 'Pack', sessions_total: 5, currency: 'RUB' })
        expect(api.post).toHaveBeenCalledWith('/coach/packages', { name: 'Pack', sessions_total: 5, currency: 'RUB' })
        await coachApi.updatePackage(3, { price_amount: '6000.00' })
        expect(api.patch).toHaveBeenCalledWith('/coach/packages/3', { price_amount: '6000.00' })
        await coachApi.archivePackage(3)
        expect(api.delete).toHaveBeenCalledWith('/coach/packages/3')

        await coachApi.listClientPackages(11)
        expect(api.get).toHaveBeenCalledWith('/coach/clients/11/packages')
        await coachApi.assignClientPackage(11, { package_id: 3, auto_consume: false })
        expect(api.post).toHaveBeenCalledWith('/coach/clients/11/packages', { package_id: 3, auto_consume: false })
        await coachApi.consumeClientPackage(11, 7, 'op-1')
        expect(api.post).toHaveBeenCalledWith('/coach/clients/11/packages/7/consume', {}, { headers: { 'Idempotency-Key': 'op-1' } })
        await coachApi.reverseClientPackage(11, 7)
        expect(api.post).toHaveBeenCalledWith('/coach/clients/11/packages/7/reverse', {})

        await coachApi.listClientPayments(11)
        expect(api.get).toHaveBeenCalledWith('/coach/clients/11/payments')
        await coachApi.recordClientPayment(11, { amount: 5000, currency: 'RUB', method: 'CARD' })
        expect(api.post).toHaveBeenCalledWith('/coach/clients/11/payments', { amount: 5000, currency: 'RUB', method: 'CARD' })
        await coachApi.reverseClientPayment(11, 9)
        expect(api.post).toHaveBeenCalledWith('/coach/clients/11/payments/9/reverse', {})

        await coachApi.listTasks({ completed: false, due_today: true })
        expect(api.get).toHaveBeenCalledWith('/coach/tasks?completed=false&due_today=true')
        await coachApi.createTask({ title: 'Call client', priority: 'NORMAL' })
        expect(api.post).toHaveBeenCalledWith('/coach/tasks', { title: 'Call client', priority: 'NORMAL' })
        await coachApi.completeTask(4)
        expect(api.post).toHaveBeenCalledWith('/coach/tasks/4/complete', {})
        await coachApi.deleteTask(4)
        expect(api.delete).toHaveBeenCalledWith('/coach/tasks/4')
    })

    it('sends consume idempotency keys in headers, not URLs', async () => {
        await coachApi.consumeClientPackage(11, 7, 'secret-op-key')
        expect(api.post).toHaveBeenCalledWith(
            '/coach/clients/11/packages/7/consume',
            {},
            { headers: { 'Idempotency-Key': 'secret-op-key' } },
        )
    })
})
