/**
 * useBackendHealth: periodic backend readiness check for `HealthCheckGate`.
 *
 * Only an explicit answer from the backend ("not ready" or a 5xx) counts as an outage.
 * Being offline, a network error, a timeout or a misrouted probe (404 / SPA HTML) do
 * NOT: the app is offline-first, and blocking it there would hide an active workout
 * and the local sync queue behind a maintenance screen.
 */

import { useEffect, useRef, useState } from 'react'
import { getPublicApiBaseUrl } from '@shared/config/runtime'
import { resolveBackendReadinessUrl } from '@shared/config/readinessUrl'
import type { components } from '@shared/api/generated/openapi'

/** `GET /health/ready`: `{ status: 'ready' | 'degraded', checks: { postgres, redis } }` (503 when degraded). */
export type ReadinessResponse = components['schemas']['ReadinessResponse']

/**
 * - `checking`    — no result yet
 * - `ready`       — backend answered `status: ready`
 * - `not_ready`   — backend answered `status: degraded` or 5xx: a real outage
 * - `offline`     — the device has no network (`navigator.onLine === false`)
 * - `unreachable` — network error / timeout (backend or network unknown)
 * - `unknown`     — probe answered, but not with a readiness payload (404, HTML):
 *                   misconfigured proxy, not a reason to block the UI
 */
export type BackendHealthStatus =
    | 'checking'
    | 'ready'
    | 'not_ready'
    | 'offline'
    | 'unreachable'
    | 'unknown'

export interface BackendHealth {
    status: BackendHealthStatus
    /** `false` only when the backend explicitly reported an outage (`not_ready`). */
    isReady: boolean
    /** A check is in flight. */
    isLoading: boolean
    error?: string
    readinessData?: ReadinessResponse
}

export interface UseBackendHealthOptions {
    /** Poll interval while the backend is not confirmed ready. Default 5 s. */
    checkIntervalMs?: number
    /** Poll interval once the backend is ready. Default 30 s. */
    healthyIntervalMs?: number
    /** Delay before the first check. Default 500 ms. */
    initialCheckDelayMs?: number
    /** Abort a hanging probe after this long (→ `unreachable`). Default 5 s. */
    requestTimeoutMs?: number
}

type CheckResult = Pick<BackendHealth, 'status' | 'error' | 'readinessData'>

function isReadinessResponse(value: unknown): value is ReadinessResponse {
    if (!value || typeof value !== 'object') return false
    const status = (value as { status?: unknown }).status
    return status === 'ready' || status === 'degraded'
}

function isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function readJson(response: Response): Promise<unknown> {
    try {
        return await response.json()
    } catch {
        return undefined
    }
}

export async function checkBackendReadiness(url: string, timeoutMs: number): Promise<CheckResult> {
    if (isOffline()) {
        return { status: 'offline', error: 'Нет подключения к сети' }
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller?.signal,
        })
        const body = await readJson(response)

        if (response.status >= 500) {
            return {
                status: 'not_ready',
                error: `Health check failed: ${response.status}`,
                readinessData: isReadinessResponse(body) ? body : undefined,
            }
        }
        if (!response.ok || !isReadinessResponse(body)) {
            return {
                status: 'unknown',
                error: `Readiness probe returned ${response.status} without a readiness payload (${url})`,
            }
        }
        return {
            status: body.status === 'ready' ? 'ready' : 'not_ready',
            error: body.status === 'ready' ? undefined : 'Backend reported degraded',
            readinessData: body,
        }
    } catch (err) {
        if (isOffline()) {
            return { status: 'offline', error: 'Нет подключения к сети' }
        }
        const aborted = err instanceof Error && err.name === 'AbortError'
        return {
            status: 'unreachable',
            error: aborted
                ? `Health check timed out after ${timeoutMs} ms`
                : err instanceof Error
                  ? err.message
                  : 'Backend is not responding',
        }
    } finally {
        if (timer) clearTimeout(timer)
    }
}

export function useBackendHealth(options: UseBackendHealthOptions = {}): BackendHealth {
    const {
        checkIntervalMs = 5000,
        healthyIntervalMs = 30000,
        initialCheckDelayMs = 500,
        requestTimeoutMs = 5000,
    } = options

    const [result, setResult] = useState<CheckResult>({ status: 'checking' })
    const [isLoading, setIsLoading] = useState(true)
    const warnedAboutProbeRef = useRef(false)

    useEffect(() => {
        let mounted = true
        let inFlight = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const url = resolveBackendReadinessUrl(
            getPublicApiBaseUrl(),
            typeof window !== 'undefined' ? window.location.origin : undefined,
        )

        const schedule = (delayMs: number) => {
            if (timeoutId) clearTimeout(timeoutId)
            timeoutId = setTimeout(() => void run(), delayMs)
        }

        const run = async () => {
            if (!mounted || inFlight) return
            // Hidden tab (Telegram minimised): skip the request, look again later.
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                schedule(checkIntervalMs)
                return
            }
            inFlight = true
            setIsLoading(true)
            const next = await checkBackendReadiness(url, requestTimeoutMs)
            inFlight = false
            if (!mounted) return

            if (next.status === 'unknown' && !warnedAboutProbeRef.current) {
                warnedAboutProbeRef.current = true
                console.warn(`[health] ${next.error}. Check the /health/ready proxy.`)
            }
            setResult(next)
            setIsLoading(false)
            schedule(next.status === 'ready' ? healthyIntervalMs : checkIntervalMs)
        }

        const recheckNow = () => schedule(0)
        const onVisibility = () => {
            if (document.visibilityState === 'visible') recheckNow()
        }

        schedule(initialCheckDelayMs)
        window.addEventListener('online', recheckNow)
        window.addEventListener('offline', recheckNow)
        document.addEventListener('visibilitychange', onVisibility)

        return () => {
            mounted = false
            if (timeoutId) clearTimeout(timeoutId)
            window.removeEventListener('online', recheckNow)
            window.removeEventListener('offline', recheckNow)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [checkIntervalMs, healthyIntervalMs, initialCheckDelayMs, requestTimeoutMs])

    return {
        status: result.status,
        isReady: result.status !== 'not_ready',
        isLoading,
        error: result.error,
        readinessData: result.readinessData,
    }
}

export default useBackendHealth
