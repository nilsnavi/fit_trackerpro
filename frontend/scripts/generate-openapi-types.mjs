import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, '..', '..')
const openapiJsonPath = path.join(repoRoot, 'frontend', 'src', 'shared', 'api', 'generated', 'openapi.json')
const outTypesPath = path.join(repoRoot, 'frontend', 'src', 'shared', 'api', 'generated', 'openapi.d.ts')

async function exportOpenApi() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      'python',
      ['backend/tools/export_openapi.py', '--out', openapiJsonPath],
      { cwd: repoRoot, stdio: 'inherit' },
    )
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`OpenAPI export failed (exit ${code ?? 'unknown'})`))
    })
  })
}

async function generateTypes() {
  const schemaText = await fs.readFile(openapiJsonPath, 'utf-8')
  const schema = JSON.parse(schemaText)
  const ast = await openapiTS(schema, {
    exportType: true,
    immutableTypes: true,
  })
  const dtsText = astToString(ast)
  await fs.mkdir(path.dirname(outTypesPath), { recursive: true })
  await fs.writeFile(outTypesPath, dtsText.trimEnd() + '\n', 'utf-8')
}

await exportOpenApi()
await generateTypes()
console.log(`Wrote ${path.relative(repoRoot, outTypesPath)}`)
