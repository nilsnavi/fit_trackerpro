'use strict'
/**
 * Граница сетевого слоя для ESLint (flat config, SPEC-005).
 *
 * Раскладка политики `networkBoundary.policy.cjs` по областям — единый источник для
 * `frontend/eslint.config.js` (реальный линт) и для архитектурного теста
 * `src/__tests__/architecture/eslintNetworkBoundary.test.ts`, который проверяет, что
 * области не написаны заново, а целиком взяты из политики.
 *
 * Модуль намеренно CommonJS (`.cjs`): его синхронно требует и flat-конфиг (через
 * `createRequire`), и тест.
 */
const boundary = require('./networkBoundary.policy.cjs')

const IMPORT_RULE = '@typescript-eslint/no-restricted-imports'

module.exports = {
    IMPORT_RULE,
    overrides: [
        {
            // Компоненты: сеть целиком — не их дело.
            files: boundary.COMPONENT_GLOBS,
            ignores: boundary.TEST_GLOBS,
            rules: {
                [IMPORT_RULE]: boundary.COMPONENT_IMPORTS,
                'no-restricted-syntax': boundary.COMPONENT_IMPORT_NAME_RULE,
                'no-restricted-globals': boundary.COMPONENT_GLOBAL_RULE,
                'no-restricted-properties': boundary.COMPONENT_GLOBAL_PROPERTY_RULE,
            },
        },
        {
            // Владельцы клиентов API: запрещён только движок очереди.
            files: boundary.API_CLIENT_OWNER_GLOBS,
            ignores: [...boundary.COMPONENT_GLOBS, ...boundary.QUEUE_ENGINE_OWNER_GLOBS, ...boundary.TEST_GLOBS],
            rules: { [IMPORT_RULE]: boundary.QUEUE_ENGINE_IMPORTS },
        },
        {
            // Владельцы очереди: запрещены только клиенты API.
            files: boundary.QUEUE_ENGINE_OWNER_GLOBS,
            ignores: [...boundary.API_CLIENT_OWNER_GLOBS, ...boundary.COMPONENT_GLOBS, ...boundary.TEST_GLOBS],
            rules: { [IMPORT_RULE]: boundary.API_CLIENT_IMPORTS },
        },
        {
            // Все остальные: ни клиентов API, ни движка очереди.
            files: boundary.SOURCE_GLOBS,
            ignores: [
                ...boundary.API_CLIENT_OWNER_GLOBS,
                ...boundary.QUEUE_ENGINE_OWNER_GLOBS,
                ...boundary.COMPONENT_GLOBS,
                ...boundary.TEST_GLOBS,
            ],
            rules: { [IMPORT_RULE]: boundary.API_CLIENT_AND_QUEUE_IMPORTS },
        },
    ],
}