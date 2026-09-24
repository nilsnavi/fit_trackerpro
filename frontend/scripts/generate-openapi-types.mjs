/** Генерирует закоммиченные артефакты OpenAPI-контракта фронтенда из схемы backend. */

import { describeInterpreter, resolvePinnedPython } from './lib/openapiPython.mjs'
import { buildContract, relativePath, writeTextLf } from './lib/openapiTypes.mjs'

try {
    const python = await resolvePinnedPython()
    const artifacts = await buildContract(python)

    for (const { path: artifactPath, text } of artifacts) {
        await writeTextLf(artifactPath, text)
    }

    console.log(
        `Wrote ${artifacts.map(({ path: artifactPath }) => relativePath(artifactPath)).join(' and ')} using ${describeInterpreter(python)}.`,
    )
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}
