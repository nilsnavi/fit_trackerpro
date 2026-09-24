/**
 * Автономная проверка закоммиченного контракта: ни backend, ни пиновый Python.
 *
 * Полная проверка (`api:contract:check`) сверяет артефакты со свежим экспортом и ради
 * этого поднимает пропиновое окружение. Здесь проверяется то, что видно из самих файлов:
 * `openapi.json` — пригодный документ OpenAPI, а `openapi.d.ts` — ровно его типы. Это
 * ловит рассинхронизацию пары (половинчатая перегенерация, ручная правка, смешанный
 * cherry-pick), но не устаревание относительно backend — для него нужен полный прогон.
 */

import { generateTypes, inspectOpenApiDocument, openapiJsonPath, openapiTypesPath, readTextLf, relativePath } from './lib/openapiTypes.mjs'

try {
    const problems = []
    const documentText = await readTextLf(openapiJsonPath)

    if (documentText === null) {
        problems.push(`  - ${relativePath(openapiJsonPath)}: missing`)
    } else {
        const { document, problem } = inspectOpenApiDocument(documentText)

        if (problem) {
            problems.push(`  - ${relativePath(openapiJsonPath)} is not a usable OpenAPI document: ${problem}`)
        } else {
            const expected = await generateTypes(document, `The committed ${relativePath(openapiJsonPath)}`)
            const committed = await readTextLf(openapiTypesPath)

            if (committed === null) {
                problems.push(`  - ${relativePath(openapiTypesPath)}: missing`)
            } else if (committed !== expected) {
                problems.push(
                    `  - ${relativePath(openapiTypesPath)}: not the types of the committed openapi.json — ` +
                        `expected ${expected.length} chars, committed ${committed.length} chars`,
                )
            }
        }
    }

    if (problems.length > 0) {
        console.error(
            [
                'Committed OpenAPI contract check failed.',
                '',
                ...problems,
                '',
                'Fix:',
                '  cd frontend && npm run api:types:generate',
            ].join('\n'),
        )
        process.exit(1)
    }

    console.log(
        `Committed OpenAPI contract OK (openapi.json is usable, openapi.d.ts is generated from it).\n` +
            'No backend was run: this proves the pair is consistent, not that it matches the current API.',
    )
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}
