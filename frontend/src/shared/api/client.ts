import axios, { AxiosInstance, isAxiosError } from 'axios'
import * as Sentry from '@sentry/react'
import { isSentryEnabled } from '@app/sentry'
import { getPublicApiBaseUrl } from '@shared/config/runtime'
import { AppHttpError, normalizeError } from '@shared/errors'
import { getAuthTokens, useAuthStore } from '@/stores/authStore'

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
                const originalConfig = isAxiosError(error) ? error.config : undefined

                // Refresh-once strategy: if access token expired, try refresh token and retry request.
                if (
                    clientError.status === 401 &&
                    originalConfig &&
                    !(originalConfig as any)._retry
                ) {
                    const { refreshToken } = getAuthTokens()
                    if (refreshToken) {
                        try {
                            (originalConfig as any)._retry = true
                            const res = await this.client.post<{
                                access_token: string
                                refresh_token: string
                            }>('/users/auth/refresh', { refresh_token: refreshToken })
                            useAuthStore.getState().setTokens({
                                accessToken: res.data.access_token,
                                refreshToken: res.data.refresh_token,
                            })
                            return await this.client.request(originalConfig)
                        } catch {
                            // fall through to redirect boundary below
                            useAuthStore.getState().clear()
                        }
                    }
                }

                if (
                    clientError.status === 401 &&
                    typeof window !== 'undefined' &&
                    window.location.pathname !== '/login'
                ) {
                    // Minimal auth boundary UX: redirect to login and preserve return URL.
                    const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
                    try {
                        sessionStorage.setItem('return_url_after_login', returnUrl)
                    } catch {
                        // ignore
                    }
                    window.location.href = `/login?from=${encodeURIComponent(returnUrl)}`
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
