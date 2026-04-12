/** @type {import('jest').Config} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    testEnvironmentOptions: {
        // jsdom 20 exposes SubtleCrypto but not crypto.randomUUID; enable it via Node.js built-in.
        customExportConditions: ['node', 'require', 'default'],
    },
    // setupFiles runs in Node.js scope BEFORE the test framework is installed.
    // Used for low-level polyfills (crypto, fetch) that need to be in place before any imports.
    setupFiles: ['<rootDir>/src/__mocks__/jest.globals.ts'],
    roots: ['<rootDir>/src'],
    /** Vitest-only suites (`*.vitest.*`) — см. `vite.config.ts` → `test`. */
    testPathIgnorePatterns: ['/node_modules/', '\\.vitest\\.(tsx?|jsx?)$'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx'
            }
        }]
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^virtual:pwa-register/react$': '<rootDir>/src/__mocks__/virtual-pwa-register-react.ts',
        '^@shared/config/runtime$': '<rootDir>/src/__mocks__/shared-config-runtime.ts',
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@app/(.*)$': '<rootDir>/src/app/$1',
        '^@features/(.*)$': '<rootDir>/src/features/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/main.tsx',
        '!src/vite-env.d.ts',
        '!src/**/index.ts'
    ],
    coverageThreshold: {
        global: {
            // Realistic baseline for the current test suite (many UI pages untested).
            // TODO: raise incrementally as more component tests are added.
            branches: 8,
            functions: 11,
            lines: 16,
            statements: 16
        },
        // Critical offline sync engine — raised after new engine tests.
        'src/shared/offline/syncQueue/engine.ts': {
            branches: 55,
            functions: 70,
            lines: 75,
            statements: 75
        },
        'src/shared/offline/syncQueue/recoverableError.ts': {
            branches: 60,
            functions: 100,
            lines: 70,
            statements: 70
        },
        'src/shared/offline/syncQueue/types.ts': {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100
        },
        'src/shared/offline/syncQueue/workoutKinds.ts': {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100
        },
        // Conflict resolution — offline sync boundary.
        'src/shared/offline/conflictResolution.ts': {
            branches: 60,
            functions: 60,
            lines: 75,
            statements: 75
        },
        // Offline enqueue helpers — all paths must be covered.
        'src/shared/offline/workoutOfflineEnqueue.ts': {
            branches: 60,
            functions: 80,
            lines: 80,
            statements: 80
        },
        // Telegram environment detection is a fragile integration boundary.
        'src/shared/lib/telegramEnv.ts': {
            branches: 80,
            functions: 100,
            lines: 100,
            statements: 100
        },
        // Error normalisation — critical for all API error handling.
        'src/shared/errors/normalizeError.ts': {
            branches: 65,
            functions: 70,
            lines: 80,
            statements: 80
        },
        // RouteErrorBoundary — raised from near-zero to meaningful threshold.
        'src/shared/ui/RouteErrorBoundary.tsx': {
            branches: 40,
            functions: 60,
            lines: 70,
            statements: 70
        },
        'src/shared/ui/Button.tsx': {
            branches: 80,
            functions: 100,
            lines: 100,
            statements: 100
        },
    },
    coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov', 'cobertura', 'html'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    moduleDirectories: ['node_modules'],
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true
};
