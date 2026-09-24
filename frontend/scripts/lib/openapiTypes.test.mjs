/**
 * Unit tests for openapiTypes atomic LF writers.
 * Run: node --test scripts/lib/openapiTypes.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { writeTextLf } from './openapiTypes.mjs'

async function withTempDir(run) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openapi-types-'))
    try {
        return await run(dir)
    } finally {
        await fs.rm(dir, { recursive: true, force: true })
    }
}

test('writeTextLf creates missing parent directories before writing', async () => {
    await withTempDir(async (dir) => {
        const target = path.join(dir, 'src', 'shared', 'api', 'generated', 'openapi.json')
        // Parent chain must not exist yet — this is the ENOENT recovery scenario.
        await assert.rejects(() => fs.stat(path.dirname(target)), { code: 'ENOENT' })

        await writeTextLf(target, '{\n  "openapi": "3.1.0"\n}\n')

        const text = await fs.readFile(target, 'utf-8')
        assert.equal(text, '{\n  "openapi": "3.1.0"\n}\n')
        assert.equal((await fs.stat(path.dirname(target))).isDirectory(), true)
    })
})

test('writeTextLf recovers both artifacts when the entire generated directory is absent', async () => {
    await withTempDir(async (dir) => {
        const generatedDir = path.join(dir, 'frontend', 'src', 'shared', 'api', 'generated')
        const jsonPath = path.join(generatedDir, 'openapi.json')
        const typesPath = path.join(generatedDir, 'openapi.d.ts')

        await writeTextLf(jsonPath, '{"openapi":"3.1.0","info":{"title":"t"},"paths":{"/x":{}}}\n')
        await writeTextLf(typesPath, 'export type paths = Record<string, never>;\n')

        assert.equal(await fs.readFile(jsonPath, 'utf-8'), '{"openapi":"3.1.0","info":{"title":"t"},"paths":{"/x":{}}}\n')
        assert.equal(await fs.readFile(typesPath, 'utf-8'), 'export type paths = Record<string, never>;\n')
    })
})
