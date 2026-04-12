import axios, { AxiosInstance, isAxiosError, type InternalAxiosRequestConfig } from 'axios'
import * as Sentry from '@sentry/react'
import { isSentryEnabled } from '@app/sentry'
import { getPublicApiBaseUrl } from '@shared/config/runtime'
import { AppHttpError, normalizeError } from '@shared/errors'
import { getAuthTokens, useAuthStore } from '@/stores/authStore'

// TODO: Устаревшие алиасы бэкенда удаляются в v1.2.0 (2026-06-30)

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean }

function isPublicAuthRequest(config: RetryableRequestConfig | undefined): boolean {
    const requestUrl = config?.url ?? ''
    return (
        requestUrl.includes('/users/auth/telegram') ||
        requestUrl.includes('/users/auth/refresh')
    )
}

function isTelegramContext(): boolean {
    try {
        const webApp = (window as { Telegram?: { WebApp?: { initData?: string } } })
            .Telegram?.WebApp
        return Boolean(webApp?.initData)
    } catch {
        return false
    }
}

/** Dispatch a custom event so TelegramAuthBootstrapGate can re-authenticate. */
export function dispatchSessionExpired(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
    }
}

/**
 * Shared refresh promise to deduplicate concurrent 401 refresh attempts.
 * When multiple requests fail with 401 at the same time, only one refresh
 * call is made; the others wait for the same promise.
 */
let refreshPromise: Promise<{ access_token: string; refresh_token: string }> | null = null

class ApiService {
    private client: AxiosInstance

    constructor() {
        this.client = axios.create({
            baseURL: getPublicApiBaseUrl(),
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        })

        this.setupInterceptors()
    }

    private setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                config.baseURL = getPublicApiBaseUrl()
                // Add auth token if available
                const { accessToken } = getAuthTokens()
                if (accessToken) {
                    config.headers.Authorization = `Bearer ${accessToken}`
                }
                if (config.data instanceof FormData) {
                    delete (config.headers as Record<string, unknown>)['Content-Type']
                }
                return config
            },
            (error) => Promise.reject(error)
        )

        // Response interceptor — reject with unified AppHttpError payload
        this.client.interceptors.response.use(
            (response) => response,
            async (error: unknown) => {
                const clientError = normalizeError(error)
                const originalConfig = isAxiosError(error)
                    ? (error.config as RetryableRequestConfig | undefined)
                    : undefined

                // Deduplicated refresh strategy: on 401, share a single refresh
                // call across all concurrent requests that failed at the same time.
                if (
                    clientError.status === 401 &&
                    originalConfig &&
                    !originalConfig._retry
                ) {
                    const { refreshToken } = getAuthTokens()
                    if (refreshToken) {
                        try {
                            originalConfig._retry = true

                            if (!refreshPromise) {
                                refreshPromise = this.client
                                    .post<{ access_token: string; refresh_token: string }>(
                                        '/users/auth/refresh',
                                        { refresh_token: refreshToken },
                                    )
                                    .then((res) => res.data)
                                    .finally(() => { refreshPromise = null })
                            }

                            const tokens = await refreshPromise
                            useAuthStore.getState().setTokens({
                                accessToken: tokens.access_token,
                                refreshToken: tokens.refresh_token,
                            })
                            return await this.client.request(originalConfig)
                        } catch {
                            refreshPromise = null
                            useAuthStore.getState().clear()
                        }
                    }
                }

                if (
                    clientError.status === 401 &&
                    typeof window !== 'undefined' &&
                    !isPublicAuthRequest(originalConfig) &&
                    window.location.pathname !== '/login'
                ) {
                    if (isTelegramContext()) {
                        // In Telegram Mini App: signal the bootstrap gate to
                        // re-authenticate transparently instead of redirecting.
                        dispatchSessionExpired()
                    } else {
                        const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
                        try {
                            sessionStorage.setItem('return_url_after_login', returnUrl)
                        } catch {
                            // ignore
                        }
                        window.location.href = `/login?from=${encodeURIComponent(returnUrl)}`
                    }
                }
                if (clientError.status != null) {
                    console.error('API Error:', clientError)
                } else {
                    console.error('API Error:', clientError.message, clientError.code)
                }
                if (
                    isSentryEnabled() &&
                    clientError.status != null &&
                    clientError.status >= 500
                ) {
                    const captured =
                        isAxiosError(error) && error instanceof Error
                            ? error
                            : new Error(clientError.message || 'API request failed')
                    Sentry.captureException(captured, {
                        tags: { source: 'api_client' },
                        extra: {
                            status: clientError.status,
                            code: clientError.code,
                            requestUrl: clientError.requestUrl,
                        },
                    })
                }
                return Promise.reject(new AppHttpError(clientError))
            }
        )
    }

    async get<T>(url: string, params?: Record<string, unknown>) {
        const response = await this.client.get<T>(url, { params })
        return response.data
    }

    async post<T>(url: string, data?: unknown) {
        const response = await this.client.post<T>(url, data)
        return response.data
    }

    async put<T>(url: string, data?: unknown) {
        const response = await this.client.put<T>(url, data)
        return response.data
    }

    async patch<T>(url: string, data?: unknown) {
        const response = await this.client.patch<T>(url, data)
        return response.data
    }

    async delete<T>(url: string) {
        const response = await this.client.delete<T>(url)
        return response.data
    }
}

export const api = new ApiService()
