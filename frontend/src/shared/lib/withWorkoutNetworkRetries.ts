const WORKOUT_API_RETRY_DELAYS_MS = [2000, 4000, 8000] as const

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

/**
 * До 4 попыток (первая + 3 повтора) с паузами 2 с, 4 с, 8 с — для запросов активной тренировки.
 */
export async function withWorkoutNetworkRetries<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let i = 0; i <= WORKOUT_API_RETRY_DELAYS_MS.length; i++) {
        try {
            return await fn()
        } catch (e) {
            lastError = e
            if (i === WORKOUT_API_RETRY_DELAYS_MS.length) {
                break
            }
            await delay(WORKOUT_API_RETRY_DELAYS_MS[i]!)
        }
    }
    throw lastError
}
