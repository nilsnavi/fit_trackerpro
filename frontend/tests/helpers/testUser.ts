/**
 * Тестовые Telegram-пользователи для E2E (разные telegram id → разные учётки на бэкенде).
 * Подпись initData строится через `jsonStringifyPythonJsonDumps` в telegramMock.ts — кириллица в полях допустима.
 */
export type TelegramMiniAppUser = {
    id: number
    first_name: string
    username?: string
    last_name?: string
    language_code?: string
}

export function buildTelegramTestUser(userId: number, firstName: string, username?: string): TelegramMiniAppUser {
    return {
        id: userId,
        first_name: firstName,
        username: username ?? `e2e_${userId}`,
        language_code: 'en',
    }
}

/** Основной happy-path (новый пользователь в чистой БД). */
export const goldenPathUser = buildTelegramTestUser(9_100_001, 'GoldenPath', 'golden_path_e2e')

/** Повторный вход / стабильный «вернувшийся» пользователь. */
export const returningUser = buildTelegramTestUser(9_100_002, 'Returning', 'returning_e2e')

/** Офлайн-сценарий (отдельный telegram id). */
export const offlineFlowUser = buildTelegramTestUser(9_100_003, 'OfflineFlow', 'offline_e2e')

/** Разводит telegram id между воркерами Playwright при parallel: shards. */
export function scopeUserForPlaywrightWorker(user: TelegramMiniAppUser, workerIndex: number): TelegramMiniAppUser {
    return { ...user, id: user.id + workerIndex * 50_000 }
}
