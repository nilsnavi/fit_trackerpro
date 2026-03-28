import axios, { AxiosInstance } from 'axios'
import { AppHttpError, normalizeError } from '@/shared/errors'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

class ApiService {
    private client: AxiosInstance

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
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
                // Add auth token if available
                const token = localStorage.getItem('auth_token')
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`
                }
                return config
            },
            (error) => Promise.reject(error)
        )

        // Response interceptor — reject with unified AppHttpError payload
        this.client.interceptors.response.use(
            (response) => response,
            (error: unknown) => {
                const clientError = normalizeError(error)
                if (clientError.status != null) {
                    console.error('API Error:', clientError)
                } else {
                    console.error('API Error:', clientError.message, clientError.code)
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

    async delete<T>(url: string) {
        const response = await this.client.delete<T>(url)
        return response.data
    }
}

export const api = new ApiService()
