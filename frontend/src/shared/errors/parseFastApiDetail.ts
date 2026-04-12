import type { ClientFieldError, FastAPIValidationItem } from './types'

function isValidationItem(value: unknown): value is FastAPIValidationItem {
    return (
        typeof value === 'object' &&
        value !== null &&
        'msg' in value &&
        typeof (value as FastAPIValidationItem).msg === 'string'
    )
}

function formatLoc(loc: unknown): string {
    if (!Array.isArray(loc) || loc.length === 0) {
        return 'request'
    }
    return loc.map((part) => String(part)).join('.')
}

/**
 * Maps FastAPI `detail` (string | ValidationError[] | object) to a single message and optional field errors.
 */
export function parseFastApiDetail(detail: unknown): {
    message: string
    fieldErrors?: ClientFieldError[]
} {
    if (typeof detail === 'string') {
        return { message: detail }
    }

    if (Array.isArray(detail)) {
        const items = detail.filter(isValidationItem)
        if (items.length === 0) {
            return { message: 'Ошибка валидации запроса' }
        }
        const fieldErrors: ClientFieldError[] = items.map((item) => ({
            field: formatLoc(item.loc),
            message: item.msg,
        }))
        const message =
            fieldErrors.map((f) => `${f.field}: ${f.message}`).join('; ') || 'Ошибка валидации запроса'
        return { message, fieldErrors }
    }

    if (detail && typeof detail === 'object') {
        const o = detail as Record<string, unknown>
        if (typeof o.message === 'string') {
            return { message: o.message }
        }
        const nestedError = o.error
        if (nestedError && typeof nestedError === 'object' && nestedError !== null) {
            const msg = (nestedError as { message?: unknown }).message
            if (typeof msg === 'string') {
                return { message: msg }
            }
        }
        if (typeof o.error === 'string') {
            return { message: o.error }
        }
    }

    return { message: 'Запрос не выполнен' }
}
