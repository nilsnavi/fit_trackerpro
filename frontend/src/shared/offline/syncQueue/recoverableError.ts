import { isAppHttpError } from '@shared/errors'

/**
 * Ошибки, после которых имеет смысл оставить мутацию в очереди и повторить
 * (сеть, таймаут, 5xx). 4xx и 401 — не retry в очереди.
 */
export function isRecoverableSyncError(error: unknown): boolean {
    if (!isAppHttpError(error)) {
        return false
    }
    const status = error.status
    if (status === 401 || status === 403) {
        return false
    }
    if (status != null && status >= 400 && status < 500) {
        return false
    }
    if (status != null && status >= 500) {
        return true
    }
    // network / timeout / нет ответа
    if (status == null) {
        return true
    }
    return false
}
