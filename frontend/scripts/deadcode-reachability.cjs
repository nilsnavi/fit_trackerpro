#!/usr/bin/env node
/**
 * Одноразовый reachability-анализ: какие модули src недостижимы из точек входа.
 *
 * - Точки входа: main.tsx, тестовая инфраструктура (setupTests, vitest.setup).
 * - Граф: относительные импорты + алиасы @/ @app/ @features/ @shared/.
 * - Re-export файлы (export X from '...') раскрываются в источник.
 * - jest.mock('<путь>', ...) считается связью (смок-тесты мокают живые страницы).
 * - Динамические import('...') (lazy-роуты) учитываются.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', 'frontend')
const SRC = path.join(ROOT, 'src')
const EXT = ['.ts', '.tsx', '.js', '.jsx']

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(p, out)
        else if (EXT.includes(path.extname(entry.name))) out.push(p)
    }
    return out
}

const files = walk(SRC).map((p) => path.relative(SRC, p).replace(/\\/g, '/'))
const fileSet = new Set(files)

function resolveSpec(spec, fromFile) {
    let base = null
    if (spec.startsWith('.')) base = path.join(path.dirname(fromFile), spec)
    else if (spec.startsWith('@/')) base = spec.slice(2)
    else if (spec.startsWith('@app/')) base = 'app/' + spec.slice(5)
    else if (spec.startsWith('@features/')) base = 'features/' + spec.slice(10)
    else if (spec.startsWith('@shared/')) base = 'shared/' + spec.slice(8)
    else return null
    base = path.posix.normalize(base.replace(/\\/g, '/'))
    const candidates = [base, ...EXT.map((e) => base + e), ...EXT.map((e) => path.posix.join(base, 'index' + e))]
    for (const c of candidates) if (fileSet.has(c)) return c
    return null
}

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g
const MOCK_RE = /jest\.mock\(\s*['"]([^'"]+)['"]/g

const graph = new Map()
for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, file), 'utf-8')
    const deps = new Set()
    let m
    while ((m = IMPORT_RE.exec(text)) !== null) {
        const spec = m[1] || m[2] || m[3]
        if (!spec) continue
        const resolved = resolveSpec(spec, file)
        if (resolved) {
            deps.add(resolved)
            // re-export файлы: `export { X } from './y'` с единственным таким экспортом
            if (/^\s*export\s+(?:type\s+)?\{[^}]*\}\s*from\s*['"]/.test(text)) {
                // добавили выше; доп. логика не нужна — связь и так есть
            }
        }
    }
    while ((m = MOCK_RE.exec(text)) !== null) {
        const resolved = resolveSpec(m[1], file)
        if (resolved) deps.add(resolved)
    }
    graph.set(file, deps)
}

const entries = files.filter((f) => f === 'main.tsx' || f === 'setupTests.ts' || f === 'vitest.setup.ts')
const reachable = new Set()
const stack = [...entries]
while (stack.length) {
    const cur = stack.pop()
    if (reachable.has(cur)) continue
    reachable.add(cur)
    for (const dep of graph.get(cur) ?? []) if (!reachable.has(dep)) stack.push(dep)
}

const unreachable = files.filter((f) => !reachable.has(f))
console.log('== UNREACHABLE FROM ENTRY POINTS ==')
for (const f of unreachable.sort()) console.log(f)
console.log(`\ntotal files: ${files.length}, reachable: ${reachable.size}, unreachable: ${unreachable.length}`)
