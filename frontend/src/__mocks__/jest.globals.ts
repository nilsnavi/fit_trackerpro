/**
 * Jest global polyfills — executed via jest.config.js `setupFiles` BEFORE the test framework.
 * This file runs in Node.js scope and patches globals that jsdom 20 does not expose.
 *
 * ts-jest emits CommonJS here; use synchronous `require` (not `import.meta` / ESM).
 */
/* eslint-disable @typescript-eslint/no-var-requires -- setupFiles run as CJS before the test graph. */

// Polyfill crypto.randomUUID (not available in jsdom 20).
// Node.js 18+ has globalThis.crypto with randomUUID; jsdom overrides crypto but drops it.
// We patch it back from Node's built-in crypto module.
if (typeof (globalThis as unknown as Record<string, unknown>).crypto === 'undefined') {
    const nodeCrypto = require('crypto') as typeof import('crypto')
    const impl = nodeCrypto.webcrypto ?? nodeCrypto
    Object.defineProperty(globalThis, 'crypto', {
        value: impl,
        configurable: true,
        writable: true,
        enumerable: true,
    })
} else if (typeof (globalThis.crypto as unknown as Record<string, unknown>).randomUUID !== 'function') {
    const nodeCrypto = require('crypto') as typeof import('crypto')
    const webcrypto = nodeCrypto.webcrypto ?? nodeCrypto
    if (typeof webcrypto?.randomUUID === 'function') {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
            value: webcrypto.randomUUID.bind(webcrypto) as typeof crypto.randomUUID,
            configurable: true,
            writable: true,
        })
    }
}

// Polyfill IndexedDB for jsdom (needed for offline persistence tests).
try {
    if (typeof (globalThis as unknown as Record<string, unknown>).indexedDB === 'undefined') {
        require('fake-indexeddb/auto')
    }
} catch {
    // ignore
}

// Polyfill structuredClone (required by fake-indexeddb).
try {
    if (typeof (globalThis as unknown as Record<string, unknown>).structuredClone === 'undefined') {
        const nodeUtil = require('util') as typeof import('util')
        if (typeof nodeUtil?.structuredClone === 'function') {
            Object.defineProperty(globalThis, 'structuredClone', {
                value: nodeUtil.structuredClone.bind(nodeUtil),
                configurable: true,
                writable: true,
                enumerable: true,
            })
        } else {
            Object.defineProperty(globalThis, 'structuredClone', {
                value: (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown,
                configurable: true,
                writable: true,
                enumerable: true,
            })
        }
    }
} catch {
    // ignore
}
