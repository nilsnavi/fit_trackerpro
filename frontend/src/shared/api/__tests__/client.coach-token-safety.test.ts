import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import * as Sentry from '@sentry/react'
import { api } from '@shared/api/client'

jest.mock('@sentry/react', () => ({ captureException: jest.fn() }))
jest.mock('@app/sentry', () => ({ isSentryEnabled: () => true }))

function failingServerAdapter(): jest.MockedFunction<AxiosAdapter> {
    return jest.fn(async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError('Server error', 'ERR_BAD_RESPONSE', config, null, {
            status: 500,
            statusText: 'Internal Server Error',
            data: { detail: 'Temporary failure' },
            headers: {},
            config,
        })
    })
}

describe('Coach invitation secret error reporting', () => {
    const client = (api as unknown as { client: { defaults: { adapter?: unknown } } }).client

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        jest.mocked(Sentry.captureException).mockClear()
    })

    afterEach(() => {
        jest.restoreAllMocks()
        delete client.defaults.adapter
    })

    it.each([
        ['resolve query params', () => api.get('/coach/invitations/resolve', { token: 'raw-secret-token' })],
        ['accept request body', () => api.post('/coach/invitations/accept', { token: 'raw-secret-token' })],
    ])('does not send %s credentials to Sentry', async (_name, request) => {
        client.defaults.adapter = failingServerAdapter()
        await expect(request()).rejects.toBeDefined()

        const [reportedError, metadata] = jest.mocked(Sentry.captureException).mock.calls[0]
        expect(reportedError).toBeInstanceOf(Error)
        expect(reportedError).not.toHaveProperty('config')
        expect(JSON.stringify([reportedError, metadata])).not.toContain('raw-secret-token')
    })
})
