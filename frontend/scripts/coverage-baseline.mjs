import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const frontendRoot = path.resolve(__dirname, '..')
const baselinePath = path.join(frontendRoot, 'coverage.baseline.json')
const coverageSummaryPath = path.join(frontendRoot, 'coverage', 'coverage-summary.json')

function roundDown1(n) {
  return Math.floor(n * 10) / 10
}

function assertPct(x, label) {
  if (typeof x !== 'number' || Number.isNaN(x)) {
    throw new Error(`Invalid percent for ${label}: ${x}`)
  }
}

function normalizeEntry(v) {
  return {
    lines: roundDown1(v.lines?.pct ?? 0),
    statements: roundDown1(v.statements?.pct ?? 0),
    functions: roundDown1(v.functions?.pct ?? 0),
    branches: roundDown1(v.branches?.pct ?? 0),
  }
}

async function readJson(p) {
  const txt = await fs.readFile(p, 'utf-8')
  return JSON.parse(txt)
}

async function writeJson(p, obj) {
  const txt = JSON.stringify(obj, null, 2) + '\n'
  await fs.writeFile(p, txt, 'utf-8')
}

function computeExpected(current, slack, floor) {
  const expected = {}
  for (const k of ['lines', 'statements', 'functions', 'branches']) {
    const s = slack?.[k] ?? 0
    const f = floor?.[k] ?? 0
    expected[k] = roundDown1(Math.max(f, current[k] - s))
  }
  return expected
}

function formatRow(label, cur, exp) {
  return `${label}: L ${cur.lines}% (min ${exp.lines}%), S ${cur.statements}% (min ${exp.statements}%), F ${cur.functions}% (min ${exp.functions}%), B ${cur.branches}% (min ${exp.branches}%)`
}

async function cmdUpdate() {
  const baselineFile = await readJson(baselinePath)
  const summary = await readJson(coverageSummaryPath)

  const critical = baselineFile.critical ?? []
  const baseline = baselineFile.baseline ?? {}

  for (const key of critical) {
    const v = summary[key]
    if (!v) {
      // Keep entry absent if Jest didn't report it (e.g., excluded / not collected).
      continue
    }
    baseline[key] = normalizeEntry(v)
  }

  baselineFile.baseline = baseline
  await writeJson(baselinePath, baselineFile)
  console.log(`Updated baseline: ${path.relative(frontendRoot, baselinePath)}`)
}

async function cmdCheck() {
  const baselineFile = await readJson(baselinePath)
  const summary = await readJson(coverageSummaryPath)

  const slack = baselineFile.slack ?? {}
  const floor = baselineFile.minFloor ?? {}
  const critical = baselineFile.critical ?? []
  const baseline = baselineFile.baseline ?? {}

  const failures = []

  for (const key of critical) {
    const curRaw = summary[key]
    const baseRaw = baseline[key]

    if (!curRaw || !baseRaw) {
      // If there's no baseline yet, don't fail. Ask to update baseline.
      continue
    }

    const cur = normalizeEntry(curRaw)
    const exp = computeExpected(baseRaw, slack, floor)

    for (const metric of ['lines', 'statements', 'functions', 'branches']) {
      assertPct(cur[metric], `${key}.${metric}`)
      if (cur[metric] + 1e-9 < exp[metric]) {
        failures.push(`${key}: ${metric} ${cur[metric]}% < ${exp[metric]}% (baseline ${baseRaw[metric]}%, slack ${slack?.[metric] ?? 0}%)`)
      }
    }
  }

  if (failures.length) {
    console.error('Coverage regression detected for critical files:')
    for (const f of failures) console.error(`  - ${f}`)
    console.error('')
    console.error('Fix:')
    console.error('  - Improve tests for the affected module(s), or')
    console.error('  - If the drop is intended, update baseline:')
    console.error('      cd frontend && npm run coverage:baseline:update')
    process.exit(1)
  }

  // Helpful output for CI logs
  const checked = critical.filter((k) => summary[k] && baseline[k])
  if (checked.length) {
    console.log('Critical coverage baseline check OK:')
    for (const key of checked) {
      const cur = normalizeEntry(summary[key])
      const exp = computeExpected(baseline[key], slack, floor)
      console.log(`  - ${formatRow(key, cur, exp)}`)
    }
  } else {
    console.log('No critical baseline entries to check yet (baseline missing).')
  }
}

const cmd = process.argv[2]
if (!cmd || !['check', 'update'].includes(cmd)) {
  console.error('Usage: node scripts/coverage-baseline.mjs <check|update>')
  process.exit(2)
}

try {
  if (cmd === 'update') await cmdUpdate()
  else await cmdCheck()
} catch (e) {
  console.error(e?.stack || String(e))
  process.exit(1)
}

