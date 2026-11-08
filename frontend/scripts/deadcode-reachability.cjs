#!/usr/bin/env node
/**
 * Reachability-анализ: какие модули src недостижимы из точек входа.
 *
 * Режимы:
 *   node scripts/deadcode-reachability.cjs            — отчет (exit 0)
 *   node scripts/deadcode-reachability.cjs --report   — то же + формат для чтения
 *   node scripts/deadcode-reachability.cjs --check    — CI-гейт: exit 1, если появились новые недостижимые
 *                                                       прод-модули ( относительно deadcode.baseline.json)
 *   node scripts/deadcode-reachability.cjs --update   — пересобрать deadcode.baseline.json из текущего состояния
 *
 * - Точки входа: main.tsx, тестовая инфраструктура (setupTests, vitest.setup).
 * - Граф: относительные импорты + алиасы @/ @app/ @features/ @shared/.
 * - Re-export файлы (export X from '...') раскрываются в источник.
 * - jest.mock('<путь>', ...) считается связью (смок-тесты мокают живые страницы).
 * - Динамические import('...') (lazy-роуты) учитываются.
 *
 * «Прод-модуль» = не тест, не мок, не декларация типов:
 *   не под __tests__/, не *.test.*, *.spec.*, не __mocks__/, *.d.ts, *.vitest.*, setupTests.
 * Тесты, моки и d.ts исключаются из гейта: по природе они не импортируются из main.tsx.
 * Их покрытие бандла — задача bundle budgets и coverage, а не этого скрипта.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const BASELINE_PATH = path.join(ROOT, 'deadcode.baseline.json')
const REPORT_PATH = path.join(ROOT, 'deadcode-report.md')
const EXT = ['.ts', '.tsx', '.js', '.jsx']

const args = process.argv.slice(2)
const mode = args.includes('--check') ? 'check' : args.includes('--update') ? 'update' : 'report'

function isTestish(file) {
    return (
        file.includes('/__tests__/') ||
        file.startsWith('__tests__/') ||
        /\.(test|spec|vitest)\.[jt]sx?$/.test(file) ||
        file.startsWith('__mocks__/') ||
        file.includes('/__mocks__/') ||
        file.endsWith('.d.ts') ||
        file === 'setupTests.ts' ||
        file === 'vitest.setup.ts'
    )
}

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
        if (resolved) deps.add(resolved)
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
const unreachableProd = unreachable.filter((f) => !isTestish(f))
const unreachableTestish = unreachable.filter(isTestish)

function readBaseline() {
    try {
        const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
        const list = Array.isArray(raw.unreachable_prod_modules) ? raw.unreachable_prod_modules : []
        return list.map((f) => String(f).replace(/\\/g, '/'))
    } catch {
        return null
    }
}

function writeBaseline(list) {
    const payload = {
        _comment: 'Baseline недостижимых прод-модулей. Обновляйте осознанно: node scripts/deadcode-reachability.cjs --update (из frontend/). Новый файл в списке = кандидат на удаление или явное связывание.',
        generated_at: new Date().toISOString(),
        unreachable_prod_modules: [...list].sort(),
    }
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n')
}

function writeReportMd(prod, testish, totalFiles, reachableCount) {
    const lines = [
        '# Dead code reachability report',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Total files: ${totalFiles}, reachable: ${reachableCount}, unreachable: ${prod.length + testish.length} (prod: ${prod.length}, test-infra: ${testish.length})`,
        '',
        '## Unreachable prod modules',
        '',
    ]
    if (prod.length === 0) {
        lines.push('_None. All production modules are reachable from entry points._')
    } else {
        lines.push(...prod.map((f) => `- \`${f}\``))
    }
    lines.push('', '## Unreachable test infrastructure (informational, not gated)', '')
    if (testish.length === 0) {
        lines.push('_None._')
    } else {
        lines.push(...testish.map((f) => `- \`${f}\``))
    }
    fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n')
}

const fmtList = (list) => (list.length ? list.map((f) => `  - ${f}`).join('\n') : '  (none)')

if (mode === 'update') {
    writeBaseline(unreachableProd)
    console.log(`Baseline updated: ${BASELINE_PATH}`)
    console.log(`Unreachable prod modules: ${unreachableProd.length}`)
    process.exit(0)
}

if (mode === 'check') {
    const baseline = readBaseline()
    if (baseline === null) {
        console.error(`[deadcode] Baseline not found: ${BASELINE_PATH}`)
        console.error('[deadcode] Generate it once with: node scripts/deadcode-reachability.cjs --update')
        process.exit(2)
    }
    writeReportMd(unreachableProd, unreachableTestish, files.length, reachable.size)

    const baselineSet = new Set(baseline)
    const added = unreachableProd.filter((f) => !baselineSet.has(f))
    const removed = baseline.filter((f) => !unreachableProd.includes(f))

    console.log(`[deadcode] unreachable prod: ${unreachableProd.length} (baseline: ${baseline.length})`)

    if (removed.length > 0) {
        console.log(`[deadcode] Improved — ${removed.length} baseline entr(y|ies) now reachable or removed:`)
        console.log(fmtList(removed))
        console.log('[deadcode] Refresh the baseline with --update to lock in the improvement.')
    }

    if (added.length > 0) {
        console.error(`[deadcode] FAIL: ${added.length} new unreachable production module(s) vs baseline:`)
        console.error(fmtList(added))
        console.error('[deadcode] Fix: import/remove the module, or run --update ONLY if unreachable is intentional.')
        console.error(`[deadcode] Full report: ${path.relative(ROOT, REPORT_PATH)}`)
        process.exit(1)
    }

    console.log('[deadcode] OK: no new unreachable production modules.')
    process.exit(0)
}

// report mode (default) — человеческий вывод
console.log('== UNREACHABLE FROM ENTRY POINTS ==')
for (const f of unreachable.sort()) console.log(f)
console.log(`\ntotal files: ${files.length}, reachable: ${reachable.size}, unreachable: ${unreachable.length}`)
console.log(`prod modules: ${unreachableProd.length}, test-infra (not gated): ${unreachableTestish.length}`)
