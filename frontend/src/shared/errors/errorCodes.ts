export const ErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    CLIENT_ERROR: 'CLIENT_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export function httpStatusCode(status: number): string {
    return `HTTP_${status}`
}
