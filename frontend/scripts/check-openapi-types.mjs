import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, '..', '..')
const generatedDir = path.join(repoRoot, 'frontend', 'src', 'shared', 'api', 'generated')
const committedTypesPath = path.join(generatedDir, 'openapi.d.ts')

async function exportOpenApi(tmpOpenapiPath) {
  await fs.mkdir(path.dirname(tmpOpenapiPath), { recursive: true })
  await new Promise((resolve, reject) => {
    const child = spawn(
      'python',
      ['backend/tools/export_openapi.py', '--out', tmpOpenapiPath],
      { cwd: repoRoot, stdio: 'inherit' },
    )
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`OpenAPI export failed (exit ${code ?? 'unknown'})`))
    })
  })
}

async function generateTypesFromOpenApi(openapiPath) {
  const schemaText = await fs.readFile(openapiPath, 'utf-8')
  const schema = JSON.parse(schemaText)
  const ast = await openapiTS(schema, {
    exportType: true,
    immutableTypes: true,
  })
  return astToString(ast).trimEnd() + '\n'
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fittracker-openapi-'))
const tmpOpenapiPath = path.join(tmpDir, 'openapi.json')

await exportOpenApi(tmpOpenapiPath)
const expected = await generateTypesFromOpenApi(tmpOpenapiPath)

let actual = null
try {
  actual = await fs.readFile(committedTypesPath, 'utf-8')
} catch {
  // no-op
}

if (actual !== expected) {
  console.error(
    [
      'API contract drift detected: generated OpenAPI types differ from committed file.',
      '',
      `Expected (generated): ${expected.length} chars`,
      `Actual (committed): ${actual?.length ?? 0} chars`,
      '',
      'Fix:',
      '  cd frontend && npm run api:types:generate',
    ].join('\n'),
  )
  process.exit(1)
}

console.log('API contract OK (OpenAPI types match).')
