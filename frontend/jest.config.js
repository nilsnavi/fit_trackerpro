/** @type {import('jest').Config} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
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
            // Baseline kept low until overall unit test coverage improves.
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        },
        // Critical offline sync engine already has meaningful tests today.
        'src/shared/offline/syncQueue/engine.ts': {
            branches: 35,
            functions: 50,
            lines: 65,
            statements: 65
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
        // Telegram environment detection is a fragile integration boundary.
        'src/shared/lib/telegramEnv.ts': {
            branches: 60,
            functions: 80,
            lines: 80,
            statements: 80
        },
        'src/shared/ui/RouteErrorBoundary.tsx': {
            branches: 0,
            functions: 20,
            lines: 60,
            statements: 60
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
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true
};
