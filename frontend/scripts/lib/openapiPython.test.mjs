/**
 * Unit tests for openapiPython pin collection (fail-closed requirements reads).
 * Run: node --test scripts/lib/openapiPython.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readPinnedRequirements } from './openapiPython.mjs'

async function withTempDir(run) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openapi-python-'))
    try {
        return await run(dir)
    } finally {
        await fs.rm(dir, { recursive: true, force: true })
    }
}

test('readPinnedRequirements collects == pins and recursive -r includes', async () => {
    await withTempDir(async (dir) => {
        const nested = path.join(dir, 'nested')
        await fs.mkdir(nested)
        await fs.writeFile(
            path.join(nested, 'base.txt'),
            'fastapi==0.115.0\npydantic==2.10.0\n',
            'utf-8',
        )
        const root = path.join(dir, 'requirements.txt')
        await fs.writeFile(
            root,
            '-r nested/base.txt\n# comment\nuvicorn[standard]==0.32.0\n',
            'utf-8',
        )

        const pins = await readPinnedRequirements(root)
        assert.equal(pins.get('fastapi'), '0.115.0')
        assert.equal(pins.get('pydantic'), '2.10.0')
        assert.equal(pins.get('uvicorn'), '0.32.0')
        assert.equal(pins.size, 3)
    })
})

test('readPinnedRequirements fails closed when recursive -r include is missing', async () => {
    await withTempDir(async (dir) => {
        const root = path.join(dir, 'requirements.txt')
        await fs.writeFile(root, '-r nested/missing.txt\nfastapi==0.115.0\n', 'utf-8')

        await assert.rejects(
            () => readPinnedRequirements(root),
            (error) => {
                assert.ok(error instanceof Error)
                assert.match(error.message, /Cannot read requirements file/)
                assert.match(error.message, /missing\.txt|fail-closed|unreadable/i)
                return true
            },
        )
    })
})

test('readPinnedRequirements fails closed when root requirements file is missing', async () => {
    await withTempDir(async (dir) => {
        const missing = path.join(dir, 'does-not-exist.txt')
        await assert.rejects(
            () => readPinnedRequirements(missing),
            (error) => {
                assert.ok(error instanceof Error)
                assert.match(error.message, /Cannot read requirements file/)
                return true
            },
        )
    })
})
