/**
 * ─── Граница сетевого слоя (SPEC-005) ───
 *
 * Политика — в `architecture/networkBoundary.policy.cjs`: владельцы и запрещённые модули
 * объявлены там один раз, и оттуда же их берёт архитектурный гвард
 * (`src/__tests__/architecture/networkBoundary.test.ts`). Здесь — только раскладка политики по
 * областям: правило падает в момент написания импорта, а гвард остаётся страховкой.
 *
 * Правило взято у typescript-eslint, а не из ядра, из-за `allowTypeImports`: `import type { DTO }`
 * стирается при сборке и рантайм-связи с сетевым слоем не создаёт, поэтому компоненты вправе
 * называть типы api-слоя (`PREventCard`, `EmergencyMode`, таблицы аналитики на этом и живут).
 */
const boundary = require('./architecture/networkBoundary.policy.cjs')

module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh'],
    rules: {
        'react-refresh/only-export-components': [
            'warn',
            { allowConstantExport: true },
        ],
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
    // Четыре области не пересекаются, поэтому каждому файлу достаётся ровно одно правило границы.
    overrides: [
        {
            // Компоненты: сеть целиком — не их дело.
            files: boundary.COMPONENT_GLOBS,
            excludedFiles: boundary.TEST_GLOBS,
            rules: {
                '@typescript-eslint/no-restricted-imports': boundary.COMPONENT_IMPORTS,
                'no-restricted-syntax': boundary.COMPONENT_IMPORT_NAME_RULE,
                'no-restricted-globals': boundary.COMPONENT_GLOBAL_RULE,
                'no-restricted-properties': boundary.COMPONENT_GLOBAL_PROPERTY_RULE,
            },
        },
        {
            // Владельцы клиентов API: им запрещён только движок очереди.
            files: boundary.API_CLIENT_OWNER_GLOBS,
            excludedFiles: [...boundary.COMPONENT_GLOBS, ...boundary.QUEUE_ENGINE_OWNER_GLOBS, ...boundary.TEST_GLOBS],
            rules: { '@typescript-eslint/no-restricted-imports': boundary.QUEUE_ENGINE_IMPORTS },
        },
        {
            // Владельцы очереди: им запрещены только клиенты API.
            files: boundary.QUEUE_ENGINE_OWNER_GLOBS,
            excludedFiles: [...boundary.API_CLIENT_OWNER_GLOBS, ...boundary.COMPONENT_GLOBS, ...boundary.TEST_GLOBS],
            rules: { '@typescript-eslint/no-restricted-imports': boundary.API_CLIENT_IMPORTS },
        },
        {
            // Все остальные: ни клиентов API, ни движка очереди.
            files: boundary.SOURCE_GLOBS,
            excludedFiles: [
                ...boundary.API_CLIENT_OWNER_GLOBS,
                ...boundary.QUEUE_ENGINE_OWNER_GLOBS,
                ...boundary.COMPONENT_GLOBS,
                ...boundary.TEST_GLOBS,
            ],
            rules: { '@typescript-eslint/no-restricted-imports': boundary.API_CLIENT_AND_QUEUE_IMPORTS },
        },
    ],
}
