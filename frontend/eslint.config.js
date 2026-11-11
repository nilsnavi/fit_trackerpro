import js from '@eslint/js'
import { createRequire } from 'node:module'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const require = createRequire(import.meta.url)
/**
 * Граница сетевого слоя (SPEC-005): раскладка политики по областям живёт в
 * `architecture/eslintBoundaryConfig.cjs` — её же читает архитектурный тест.
 */
const { overrides: boundaryOverrides } = require('./architecture/eslintBoundaryConfig.cjs')

const TS_FILES = ['**/*.{ts,tsx}']

export default [
    {
        ignores: [
            'dist',
            'coverage',
            'node_modules',
            'playwright-report',
            'test-results',
            'bundle-report.json',
            'bundle-stats.json',
            // Линтуем только TS-исходники (эквивалент прежнего --ext ts,tsx).
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs',
        ],
    },

    // Рекомендованные правила JS для TS-исходников.
    { files: TS_FILES, ...js.configs.recommended },

    // Рекомендованные правила TypeScript (flat), ограниченные TS-исходниками.
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: TS_FILES })),

    {
        files: TS_FILES,
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/static-components': 'off',
            'react-hooks/refs': 'off',
            'react-hooks/purity': 'off',
            'react-hooks/immutability': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },

    // Playwright fixtures call a helper named `use` (not a React hook) — skip React rules in e2e.
    {
        files: ['e2e/**'],
        rules: {
            'react-hooks/rules-of-hooks': 'off',
            'react-refresh/only-export-components': 'off',
        },
    },
    // Route modules legitimately export route configs/non-components — fast-refresh rule is N/A.
    {
        files: ['**/routes.tsx', '**/routes.ts'],
        rules: { 'react-refresh/only-export-components': 'off' },
    },

    // ─── Граница сетевого слоя: четыре непересекающиеся области ───
    ...boundaryOverrides,
]