import { api } from '@shared/api/client'
import { usersApi } from '../usersApi'

jest.mock('@shared/api/client', () => ({
    api: { get: jest.fn(), delete: jest.fn() },
}))

describe('usersApi.exportData', () => {
    it('requests the export as a Blob (axios would parse the JSON file otherwise)', async () => {
        const blob = new Blob(['{}'], { type: 'application/json' })
        ;(api.get as jest.Mock).mockResolvedValue(blob)

        await expect(usersApi.exportData()).resolves.toBe(blob)

        expect(api.get).toHaveBeenCalledWith(
            '/users/export',
            undefined,
            expect.objectContaining({ responseType: 'blob' }),
        )
    })
})

describe('usersApi.deleteAccount', () => {
    it('calls DELETE /users/me', async () => {
        jest.mocked(api.delete).mockResolvedValue(undefined)

        await expect(usersApi.deleteAccount()).resolves.toBeUndefined()

        expect(api.delete).toHaveBeenCalledWith('/users/me')
    })
})
