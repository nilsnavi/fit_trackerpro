/**
 * Mock Telegram WebApp для Playwright: непустой initData + подпись HMAC как у реального WebApp
 * (совместимо с backend/app/infrastructure/telegram_auth.py).
 */

import { createHmac } from 'node:crypto'

import type { Page } from '@playwright/test'

import type { TelegramMiniAppUser } from './testUser'

const TELEGRAM_SCRIPT = 'https://telegram.org/js/telegram-web-app.js'

export function getE2eTelegramBotToken(): string {
    return process.env.E2E_TELEGRAM_BOT_TOKEN?.trim() || 'test_token_for_e2e'
}

/**
 * Эквивалент Python `json.dumps(obj, separators=(",", ":"), ensure_ascii=False)` для типичных
 * структур из строк и чисел: компактная запись без пробелов и неэкранированный Unicode в строках
 * (в JS `JSON.stringify` даёт `\uXXXX`, Python при `ensure_ascii=False` — реальные символы UTF-8).
 */
export function jsonStringifyPythonJsonDumps(obj: unknown): string {
    const compact = JSON.stringify(obj)
    return compact.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Построить строку initData (query string) с валидным hash, как в backend/app/tests/telegram_webapp.py.
 */
export function buildSignedInitData(botToken: string, user: TelegramMiniAppUser, authDate?: number): string {
    const ts = authDate ?? Math.floor(Date.now() / 1000)
    const userJson = jsonStringifyPythonJsonDumps(user)
    const fields: Record<string, string> = {
        auth_date: String(ts),
        user: userJson,
    }
    const dataCheckString = Object.keys(fields)
        .sort()
        .map((k) => `${k}=${fields[k]}`)
        .join('\n')
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
    const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
    const userParam = encodeURIComponent(userJson)
    return `user=${userParam}&auth_date=${ts}&hash=${hash}`
}

export type SetUserResult = { user: TelegramMiniAppUser; initData: string }

/** Удобный конструктор пользователя + подписанной initData для сценариев с разными id. */
export function setUser(userId: number, firstName: string, botToken?: string): SetUserResult {
    const token = botToken ?? getE2eTelegramBotToken()
    const user: TelegramMiniAppUser = {
        id: userId,
        first_name: firstName,
        username: `u${userId}`,
        language_code: 'en',
    }
    return { user, initData: buildSignedInitData(token, user) }
}

type InstallOptions = {
    user: TelegramMiniAppUser
    botToken?: string
    /** Подмена строки initData (например, с битым hash для негативных тестов). */
    initDataOverride?: string
}

/**
 * Блокирует официальный telegram-web-app.js (в браузере он перезаписал бы initData)
 * и поднимает минимальный window.Telegram.WebApp, достаточный для рантайма приложения.
 */
export async function installTelegramMiniAppMock(page: Page, { user, botToken, initDataOverride }: InstallOptions): Promise<string> {
    const token = botToken ?? getE2eTelegramBotToken()
    const initData = initDataOverride ?? buildSignedInitData(token, user)

    await page.route(TELEGRAM_SCRIPT, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/javascript; charset=utf-8',
            body: '// e2e: telegram.org script disabled; mock injected via Playwright init script\n',
        }),
    )

    await page.addInitScript(
        ({ initData: raw, unsafeUser }) => {
            const w = window as Window & {
                Telegram?: {
                    WebApp?: Record<string, unknown>
                }
            }

            const noop = (): void => {}

            w.Telegram = {
                WebApp: {
                    initData: raw,
                    initDataUnsafe: { user: unsafeUser },
                    version: '9.0',
                    platform: 'web',
                    colorScheme: 'light',
                    themeParams: {},
                    isExpanded: true,
                    viewportHeight: 800,
                    viewportStableHeight: 780,
                    ready: noop,
                    expand: noop,
                    close: noop,
                    onEvent: noop,
                    offEvent: noop,
                    sendData: noop,
                    openLink: noop,
                    openTgLink: noop,
                    openInvoice: noop,
                    showPopup: noop,
                    showAlert: noop,
                    showConfirm: noop,
                    showScanQrPopup: noop,
                    closeScanQrPopup: noop,
                    readTextFromClipboard: async () => '',
                    requestWriteAccess: noop,
                    requestContactAccess: noop,
                    requestPhoneAccess: noop,
                    setHeaderColor: noop,
                    setBackgroundColor: noop,
                    enableClosingConfirmation: noop,
                    disableClosingConfirmation: noop,
                    isVersionAtLeast: () => true,
                    HapticFeedback: {
                        impactOccurred: noop,
                        notificationOccurred: noop,
                        selectionChanged: noop,
                    },
                    MainButton: {
                        text: '',
                        color: '',
                        textColor: '',
                        isVisible: false,
                        isActive: true,
                        isProgressVisible: false,
                        setText: noop,
                        show: noop,
                        hide: noop,
                        enable: noop,
                        disable: noop,
                        showProgress: noop,
                        hideProgress: noop,
                        setParams: noop,
                        onClick: noop,
                    },
                    BackButton: { isVisible: false, show: noop, hide: noop, onClick: noop },
                    SettingsButton: { isVisible: false, show: noop, hide: noop, onClick: noop },
                    SecondaryButton: {
                        text: '',
                        color: '',
                        textColor: '',
                        isVisible: false,
                        isActive: true,
                        setText: noop,
                        show: noop,
                        hide: noop,
                        enable: noop,
                        disable: noop,
                        setParams: noop,
                        onClick: noop,
                    },
                    CloudStorage: {
                        getItem: async () => null,
                        setItem: async () => {},
                        removeItem: async () => {},
                        getKeys: async () => [],
                    },
                    BiometricManager: {
                        isAvailable: false,
                        isBiometricIdAvailable: false,
                        authenticate: async () => true,
                        requestAccess: async () => true,
                        update: noop,
                    },
                },
            }
        },
        { initData, unsafeUser: user },
    )

    return initData
}

/** initData с заведомо неверной подписью (проверка отказа входа). */
export function buildInvalidHashInitData(botToken: string, user: TelegramMiniAppUser): string {
    const base = buildSignedInitData(botToken, user)
    return base.replace(/hash=[a-f0-9]+$/i, `hash=${'0'.repeat(64)}`)
}
