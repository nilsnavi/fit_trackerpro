import { getTelegramWebAppFromWindow, isTelegramMiniAppRuntime } from '../telegramEnv'
import type { WebApp } from '@shared/types/telegram'

describe('getTelegramWebAppFromWindow', () => {
    const originalWindow = global.window

    afterEach(() => {
        // Restore window to original state after each test
        Object.defineProperty(global, 'window', {
            value: originalWindow,
            writable: true,
            configurable: true,
        })
    })

    it('returns null when window is undefined', () => {
        Object.defineProperty(global, 'window', {
            value: undefined,
            writable: true,
            configurable: true,
        })
        expect(getTelegramWebAppFromWindow()).toBeNull()
    })

    it('returns null when window.Telegram is absent', () => {
        Object.defineProperty(global, 'window', {
            value: {},
            writable: true,
            configurable: true,
        })
        expect(getTelegramWebAppFromWindow()).toBeNull()
    })

    it('returns null when window.Telegram.WebApp is undefined', () => {
        Object.defineProperty(global, 'window', {
            value: { Telegram: {} },
            writable: true,
            configurable: true,
        })
        expect(getTelegramWebAppFromWindow()).toBeNull()
    })

    it('returns the WebApp object when present', () => {
        const mockWebApp = { initData: 'some_data', version: '6.0' } as unknown as WebApp
        Object.defineProperty(global, 'window', {
            value: { Telegram: { WebApp: mockWebApp } },
            writable: true,
            configurable: true,
        })
        expect(getTelegramWebAppFromWindow()).toBe(mockWebApp)
    })
})

describe('isTelegramMiniAppRuntime', () => {
    it('returns false for null webApp', () => {
        expect(isTelegramMiniAppRuntime(null)).toBe(false)
    })

    it('returns false when initData is an empty string', () => {
        const webApp = { initData: '' } as unknown as WebApp
        expect(isTelegramMiniAppRuntime(webApp)).toBe(false)
    })

    it('returns false when initData is missing', () => {
        const webApp = {} as unknown as WebApp
        expect(isTelegramMiniAppRuntime(webApp)).toBe(false)
    })

    it('returns true when initData is a non-empty string', () => {
        const webApp = {
            initData: 'query_id=AAH&user=%7B%22id%22%3A123%7D',
        } as unknown as WebApp
        expect(isTelegramMiniAppRuntime(webApp)).toBe(true)
    })
})
