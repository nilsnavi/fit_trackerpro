import { act, renderHook } from '@testing-library/react'
import { checkBackendReadiness, useBackendHealth } from '../useBackendHealth'

// Real backend payloads (app.main /health/ready).
const READY = { status: 'ready', checks: { postgres: 'ok', redis: 'ok' } }
const DEGRADED = { status: 'degraded', checks: { postgres: 'ok', redis: 'error: connection refused' } }

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response
}

function htmlResponse(status: number): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
            throw new SyntaxError('Unexpected token <')
        },
    } as unknown as Response
}

const fetchMock = jest.fn()
const originalFetch = global.fetch

function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
    setOnline(true)
})

afterAll(() => {
    global.fetch = originalFetch
    setOnline(true)
})

describe('checkBackendReadiness', () => {
    it('is ready when the backend answers status: ready', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, READY))
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'ready' })
    })

    it('reports an outage for the 503 degraded payload', async () => {
        fetchMock.mockResolvedValue(jsonResponse(503, DEGRADED))
        const result = await checkBackendReadiness('/health/ready', 1000)
        expect(result.status).toBe('not_ready')
        expect(result.readinessData).toEqual(DEGRADED)
    })

    it('reports an outage for a degraded payload even with a 200', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, DEGRADED))
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'not_ready' })
    })

    it('reports an outage for a gateway error without a payload', async () => {
        fetchMock.mockResolvedValue(htmlResponse(502))
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'not_ready' })
    })

    it('does not treat a misrouted probe (404 / SPA HTML) as an outage', async () => {
        fetchMock.mockResolvedValue(jsonResponse(404, { detail: 'Not Found' }))
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'unknown' })

        fetchMock.mockResolvedValue(htmlResponse(200))
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'unknown' })
    })

    it('does not treat a network error as an outage', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'unreachable' })
    })

    it('skips the request entirely when the device is offline', async () => {
        setOnline(false)
        await expect(checkBackendReadiness('/health/ready', 1000)).resolves.toMatchObject({ status: 'offline' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('aborts a hanging probe after the timeout', async () => {
        jest.useFakeTimers()
        try {
            fetchMock.mockImplementation(
                (_url: string, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        init.signal?.addEventListener('abort', () => {
                            const err = new Error('aborted')
                            err.name = 'AbortError'
                            reject(err)
                        })
                    }),
            )
            const pending = checkBackendReadiness('/health/ready', 1000)
            jest.advanceTimersByTime(1000)
            const result = await pending
            expect(result.status).toBe('unreachable')
            expect(result.error).toMatch(/timed out/)
        } finally {
            jest.useRealTimers()
        }
    })
})

describe('useBackendHealth', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    async function flush(ms: number) {
        await act(async () => {
            jest.advanceTimersByTime(ms)
            await Promise.resolve()
            await Promise.resolve()
        })
    }

    it('probes the readiness URL derived from API_URL (not the SPA origin)', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, READY))
        const { result } = renderHook(() => useBackendHealth({ initialCheckDelayMs: 10 }))
        expect(result.current.status).toBe('checking')

        await flush(10)

        // Jest runtime mock: API_URL = http://localhost:8000/api/v1, page origin http://localhost
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/health/ready', expect.any(Object))
        expect(result.current.status).toBe('ready')
        expect(result.current.isReady).toBe(true)
    })

    it('stays usable (isReady) when the backend is unreachable', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
        const { result } = renderHook(() => useBackendHealth({ initialCheckDelayMs: 10 }))

        await flush(10)

        expect(result.current.status).toBe('unreachable')
        expect(result.current.isReady).toBe(true)
    })

    it('re-checks immediately when the network comes back', async () => {
        setOnline(false)
        fetchMock.mockResolvedValue(jsonResponse(200, READY))
        const { result } = renderHook(() =>
            useBackendHealth({ initialCheckDelayMs: 10, checkIntervalMs: 60_000 }),
        )
        await flush(10)
        expect(result.current.status).toBe('offline')
        expect(fetchMock).not.toHaveBeenCalled()

        setOnline(true)
        await act(async () => {
            window.dispatchEvent(new Event('online'))
        })
        await flush(0)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe('ready')
    })
})
