import { AxiosError, AxiosHeaders } from 'axios'
import {
    normalizeError,
    normalizeFromHttpResponse,
    clientErrorFromFetchResponse,
} from '../normalizeError'
import { AppHttpError } from '../AppHttpError'
import { ErrorCodes } from '../errorCodes'
import type { ClientError } from '../types'
import type { InternalAxiosRequestConfig } from 'axios'

function makeClientError(partial: Partial<ClientError> = {}): ClientError {
    return { status: null, code: 'TEST', message: 'test', ...partial }
}

function makeAxiosError(overrides: {
    code?: string
    status?: number
    responseData?: unknown
    hasRequest?: boolean
    message?: string
}): AxiosError {
    const config: InternalAxiosRequestConfig = {
        url: '/api/test',
        headers: new AxiosHeaders(),
    }
    const err = new AxiosError(
        overrides.message ?? 'axios error',
        overrides.code,
        config,
    )

    if (overrides.status !== undefined) {
        Object.defineProperty(err, 'response', {
            value: {
                status: overrides.status,
                data: overrides.responseData ?? null,
                headers: {},
                config,
            },
            writable: true,
        })
    } else if (overrides.hasRequest) {
        Object.defineProperty(err, 'request', {
            value: {},
            writable: true,
        })
    }

    return err
}

describe('normalizeError', () => {
    it('returns payload as-is for AppHttpError (idempotent)', () => {
        const payload = makeClientError({ status: 403, code: 'HTTP_403', message: 'Forbidden' })
        const err = new AppHttpError(payload)
        const result = normalizeError(err)
        expect(result).toEqual(payload)
    })

    it('maps AxiosError with 404 response to HTTP_404 code', () => {
        const err = makeAxiosError({ status: 404, responseData: { detail: 'Not Found' } })
        const result = normalizeError(err)
        expect(result.status).toBe(404)
        expect(result.code).toBe('HTTP_404')
    })

    it('maps AxiosError ECONNABORTED to TIMEOUT code', () => {
        const err = makeAxiosError({ code: 'ECONNABORTED', message: 'timeout' })
        const result = normalizeError(err)
        expect(result.code).toBe(ErrorCodes.TIMEOUT)
        expect(result.status).toBeNull()
    })

    it('maps AxiosError with request but no response to NETWORK_ERROR', () => {
        const err = makeAxiosError({ hasRequest: true })
        const result = normalizeError(err)
        expect(result.code).toBe(ErrorCodes.NETWORK_ERROR)
        expect(result.status).toBeNull()
    })

    it('maps plain Error to CLIENT_ERROR', () => {
        const result = normalizeError(new Error('something broke'))
        expect(result.code).toBe(ErrorCodes.CLIENT_ERROR)
        expect(result.message).toBe('something broke')
    })

    it('maps non-Error unknown value to UNKNOWN_ERROR', () => {
        const result = normalizeError('raw string error')
        expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
    })
})

describe('normalizeFromHttpResponse', () => {
    it('maps status 422 with FastAPI validation detail to VALIDATION_ERROR with fieldErrors', () => {
        const body = {
            detail: [
                { loc: ['body', 'email'], msg: 'value is not a valid email', type: 'value_error.email' },
            ],
        }
        const result = normalizeFromHttpResponse(422, body)
        expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(result.fieldErrors).toBeDefined()
        expect(result.fieldErrors![0].field).toBe('body.email')
        expect(result.fieldErrors![0].message).toBe('value is not a valid email')
    })

    it('strips query string from requestUrl', () => {
        const result = normalizeFromHttpResponse(400, { detail: 'Bad input' }, {
            requestUrl: '/api/v1/test?foo=bar&baz=qux',
        })
        expect(result.requestUrl).toBe('/api/v1/test')
    })
})

describe('clientErrorFromFetchResponse', () => {
    it('parses JSON body with FastAPI detail field', async () => {
        const body = JSON.stringify({ detail: 'Resource not found' })
        const response = new Response(body, {
            status: 404,
            headers: { 'content-type': 'application/json' },
        })
        const result = await clientErrorFromFetchResponse(response)
        expect(result.status).toBe(404)
        expect(result.message).toBe('Resource not found')
    })

    it('falls back gracefully for non-JSON body', async () => {
        const response = new Response('Internal Server Error', {
            status: 500,
            headers: { 'content-type': 'text/plain' },
        })
        const result = await clientErrorFromFetchResponse(response)
        expect(result.status).toBe(500)
        expect(result.code).toBe('HTTP_500')
    })
})
