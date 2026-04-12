/* eslint-disable @typescript-eslint/no-var-requires -- setup runs under ts-jest CJS; sync require for node-fetch polyfill. */
import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

// Polyfill Web Fetch API globals (Response, Request, Headers) for jsdom test environment.
// jest-environment-jsdom v29 / jsdom 20 does not expose these to the global scope by default.
if (typeof globalThis.Response === 'undefined') {
    // node-fetch v2 is a transitive dependency — safe to polyfill here.
    const nf = require('node-fetch') as typeof import('node-fetch')
    globalThis.Response = nf.Response as unknown as typeof Response
    globalThis.Request = nf.Request as unknown as typeof Request
    globalThis.Headers = nf.Headers as unknown as typeof Headers
    globalThis.fetch = nf.default as unknown as typeof fetch
}

// Мок Telegram WebApp
Object.defineProperty(window, 'Telegram', {
    value: {
        WebApp: {
            ready: jest.fn(),
            expand: jest.fn(),
            close: jest.fn(),
            initData: '',
            initDataUnsafe: {},
            version: '6.0',
            platform: 'web',
            colorScheme: 'light',
            themeParams: {},
            isExpanded: true,
            viewportHeight: 600,
            viewportStableHeight: 600,
            headerColor: '#ffffff',
            backgroundColor: '#ffffff',
            BackButton: {
                isVisible: false,
                onClick: jest.fn(),
                offClick: jest.fn(),
                show: jest.fn(),
                hide: jest.fn()
            },
            MainButton: {
                text: 'CONTINUE',
                color: '#2481cc',
                textColor: '#ffffff',
                isVisible: false,
                isActive: true,
                isProgressVisible: false,
                setText: jest.fn(),
                onClick: jest.fn(),
                offClick: jest.fn(),
                show: jest.fn(),
                hide: jest.fn(),
                enable: jest.fn(),
                disable: jest.fn(),
                showProgress: jest.fn(),
                hideProgress: jest.fn(),
                setParams: jest.fn()
            },
            HapticFeedback: {
                impactOccurred: jest.fn(),
                notificationOccurred: jest.fn(),
                selectionChanged: jest.fn()
            }
        }
    },
    writable: true
});

// Мок import.meta.env
Object.defineProperty(global, 'import', {
    value: {
        meta: {
            env: {
                VITE_API_URL: 'http://localhost:8000/api/v1',
                VITE_TELEGRAM_BOT_USERNAME: 'test_bot',
                VITE_ENVIRONMENT: 'test',
            }
        }
    }
});

// Мок IntersectionObserver
class MockIntersectionObserver {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver
});

// Мок matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Подавление ошибок консоли во время тестов
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
};
