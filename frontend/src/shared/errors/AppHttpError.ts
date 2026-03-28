import type { ClientError } from './types'

/**
 * Thrown by the API client after normalizing Axios failures.
 * Implements `toJSON()` so structured logs get a predictable payload.
 */
export class AppHttpError extends Error {
    override readonly name = 'AppHttpError'

    readonly status: number | null
    readonly code: string
    readonly fieldErrors?: ClientError['fieldErrors']
    readonly requestUrl?: string

    constructor(readonly payload: ClientError) {
        super(payload.message)
        this.status = payload.status
        this.code = payload.code
        this.fieldErrors = payload.fieldErrors
        this.requestUrl = payload.requestUrl
        Object.setPrototypeOf(this, new.target.prototype)
    }

    toJSON(): ClientError {
        return { ...this.payload }
    }
}

export function isAppHttpError(value: unknown): value is AppHttpError {
    return value instanceof AppHttpError
}
