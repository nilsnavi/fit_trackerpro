/** Сверяет закоммиченные артефакты OpenAPI-контракта со схемой backend, снятой пропиновым интерпретатором. */

import { describeInterpreter, resolvePinnedPython } from './lib/openapiPython.mjs'
import { buildContract, inspectOpenApiDocument, readTextLf, relativePath } from './lib/openapiTypes.mjs'

try {
    const python = await resolvePinnedPython()
    const artifacts = await buildContract(python)

    const problems = []
    for (const { role, path: artifactPath, text: expected } of artifacts) {
        const actual = await readTextLf(artifactPath)

        if (actual !== expected) {
            const committed = actual === null ? 'missing' : `${actual.length} chars`
            problems.push(`  - ${relativePath(artifactPath)}: expected ${expected.length} chars, committed ${committed}`)
        }

        // Закоммиченный документ обязан быть пригодным сам по себе, а не только равным экспорту.
        if (role === 'document' && actual !== null) {
            const { problem } = inspectOpenApiDocument(actual)
            if (problem) problems.push(`  - ${relativePath(artifactPath)} is not a usable OpenAPI document: ${problem}`)
        }
    }

    if (problems.length > 0) {
        console.error(
            [
                'API contract drift detected: generated OpenAPI artifacts differ from committed files.',
                '',
                ...problems,
                `Exported with ${describeInterpreter(python)}`,
                '',
                'Fix:',
                '  cd frontend && npm run api:types:generate',
            ].join('\n'),
        )
        process.exit(1)
    }

    console.log(
        `API contract OK (${artifacts.length} OpenAPI artifacts match).\nExported with ${describeInterpreter(python)}`,
    )
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}
