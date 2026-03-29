/**
 * Стабильная сериализация и короткий хэш для dedupeKey при создании сущностей
 * (одинаковый payload → один элемент в очереди).
 */
function sortValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
        return value
    }
    if (Array.isArray(value)) {
        return value.map(sortValue)
    }
    const o = value as Record<string, unknown>
    const keys = Object.keys(o).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) {
        out[k] = sortValue(o[k])
    }
    return out
}

export function stableStringify(value: unknown): string {
    return JSON.stringify(sortValue(value))
}

/** Небольшой детерминированный хэш строки (djb2). */
export function hashStringDjb2(s: string): string {
    let hash = 5381
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 33) ^ s.charCodeAt(i)
    }
    return (hash >>> 0).toString(36)
}

export function payloadDedupeKey(prefix: string, payload: unknown): string {
    return `${prefix}:${hashStringDjb2(stableStringify(payload))}`
}
