import axios, { type AxiosError } from 'axios'
import { ErrorCodes, httpStatusCode } from './errorCodes'
import { AppHttpError, isAppHttpError } from './AppHttpError'
import { parseFastApiDetail } from './parseFastApiDetail'
import type { ClientError } from './types'

function stripQuery(url: string): string {
    const i = url.indexOf('?')
    return i === -1 ? url : url.slice(0, i)
}

/**
 * Build {@link ClientError} from HTTP status and parsed JSON (or other) body.
 * Handles FastAPI `{ detail: ... }` and plain objects with `message` / `error`.
 */
export function normalizeFromHttpResponse(
    status: number,
    body: unknown,
    options?: { requestUrl?: string },
): ClientError {
    const requestUrl = options?.requestUrl ? stripQuery(options.requestUrl) : undefined

    let detail: unknown
    if (body && typeof body === 'object' && 'detail' in body) {
        detail = (body as { detail: unknown }).detail
    } else {
        detail = body
    }

    const { message, fieldErrors } = parseFastApiDetail(detail)
    const code = status === 422 ? ErrorCodes.VALIDATION_ERROR : httpStatusCode(status)

    return {
        status,
        code,
        message,
        fieldErrors,
        requestUrl,
    }
}

function normalizeAxiosError(error: AxiosError<unknown>): ClientError {
    let fullUrl: string | undefined
    if (error.config) {
        try {
            fullUrl = stripQuery(axios.getUri(error.config))
        } catch {
            fullUrl = error.config.url ? stripQuery(String(error.config.url)) : undefined
        }
    }

    if (error.code === 'ECONNABORTED') {
        return {
            status: null,
            code: ErrorCodes.TIMEOUT,
            message: 'Request timed out',
            requestUrl: fullUrl,
        }
    }

    if (error.response) {
        return normalizeFromHttpResponse(error.response.status, error.response.data, {
            requestUrl: fullUrl,
        })
    }

    if (error.request) {
        return {
            status: null,
            code: ErrorCodes.NETWORK_ERROR,
            message: 'Network error — check your connection',
            requestUrl: fullUrl,
        }
    }

    return {
        status: null,
        code: ErrorCodes.CLIENT_ERROR,
        message: error.message || 'Request failed',
        requestUrl: fullUrl,
    }
}

/**
 * Map any thrown value to {@link ClientError} (idempotent for {@link AppHttpError}).
 */
export function normalizeError(error: unknown): ClientError {
    if (isAppHttpError(error)) {
        return { ...error.payload }
    }

    if (axios.isAxiosError(error)) {
        return normalizeAxiosError(error)
    }

    if (error instanceof Error) {
        return {
            status: null,
            code: ErrorCodes.CLIENT_ERROR,
            message: error.message || ErrorCodes.UNKNOWN_ERROR,
        }
    }

    return {
        status: null,
        code: ErrorCodes.UNKNOWN_ERROR,
        message: 'Something went wrong',
    }
}

/**
 * Prefer in `catch` blocks: same shape as axios rejections after the interceptor.
 */
export function toAppHttpError(error: unknown): AppHttpError {
    if (isAppHttpError(error)) {
        return error
    }
    return new AppHttpError(normalizeError(error))
}

export function getErrorMessage(error: unknown): string {
    return normalizeError(error).message
}

/**
 * Reads a failed `fetch` response body once and returns a {@link ClientError}.
 */
export async function clientErrorFromFetchResponse(response: Response): Promise<ClientError> {
    let body: unknown
    const contentType = response.headers.get('content-type') ?? ''
    try {
        if (contentType.includes('application/json')) {
            body = await response.json()
        } else {
            const text = await response.text()
            body = text ? { detail: text } : undefined
        }
    } catch {
        body = undefined
    }
    return normalizeFromHttpResponse(response.status, body, { requestUrl: response.url })
}
