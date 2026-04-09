/**
 * Jest global polyfills — executed via jest.config.js `setupFiles` BEFORE the test framework.
 * This file runs in Node.js scope and patches globals that jsdom 20 does not expose.
 */

// Polyfill crypto.randomUUID (not available in jsdom 20).
// Node.js 18+ has globalThis.crypto with randomUUID; jsdom overrides crypto but drops it.
// We patch it back from Node's built-in crypto module.
if (typeof (globalThis as unknown as Record<string, unknown>).crypto === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ; (globalThis as any).crypto = nodeCrypto.webcrypto ?? nodeCrypto
} else if (typeof (globalThis.crypto as unknown as Record<string, unknown>).randomUUID !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto')
    const webcrypto = nodeCrypto.webcrypto ?? nodeCrypto
    if (typeof webcrypto?.randomUUID === 'function') {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value: webcrypto.randomUUID.bind(webcrypto) as typeof crypto.randomUUID,
            configurable: true,
            writable: true,
        })
    }
}
