import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const gzip = promisify(zlib.gzip)
const brotliCompress = promisify(zlib.brotliCompress)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendRoot = path.resolve(__dirname, '..')

const distDir = path.join(frontendRoot, 'dist')
const statsPath = path.join(distDir, 'bundle-stats.json')
const manifestPath = path.join(distDir, '.vite', 'manifest.json')
const budgetPath = path.join(frontendRoot, 'bundle-budget.json')

async function readJson(p) {
  const txt = await fs.readFile(p, 'utf-8')
  return JSON.parse(txt)
}

function bytes(n) {
  return `${(n / 1024).toFixed(2)} KiB`
}

async function measureFileSizes(absPath) {
  const buf = await fs.readFile(absPath)
  const gz = await gzip(buf, { level: 9 })
  const br = await brotliCompress(buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    },
  })
  return { rawBytes: buf.length, gzipBytes: gz.length, brotliBytes: br.length }
}

function pickMetric(measured) {
  const m = measured?.metric ?? 'gzip'
  if (!['raw', 'gzip', 'brotli'].includes(m)) {
    throw new Error(`Unsupported metric in bundle-budget.json: ${m}`)
  }
  return m
}

function getMetricBytes(sizes, metric) {
  if (metric === 'raw') return sizes.rawBytes
  if (metric === 'gzip') return sizes.gzipBytes
  return sizes.brotliBytes
}

function uniq(arr) {
  return [...new Set(arr)]
}

function isJsFile(fileName) {
  return fileName.endsWith('.js') || fileName.endsWith('.mjs')
}

function chunkMatchesAnyInclude(fileName, includes) {
  return (includes ?? []).some((s) => fileName.includes(s))
}

function classifyChunks({ chunks, budgets }) {
  const vendorNameIncludes = budgets.classifiers?.vendor?.nameIncludes ?? []
  const vendorRatio = budgets.classifiers?.vendor?.nodeModulesRatioGte ?? 0.7
  const asyncFacadeIncludes = budgets.classifiers?.asyncRoute?.facadeModuleIdIncludes ?? []
  const dndIncludes = budgets.classifiers?.dnd?.fileNameIncludes ?? []
  const modalIncludes = budgets.classifiers?.modal?.fileNameIncludes ?? []

  const vendor = []
  const entry = []
  const asyncRoute = []
  const other = []
  const dnd = []
  const modal = []

  for (const c of chunks) {
    if (!isJsFile(c.fileName)) continue

    if (chunkMatchesAnyInclude(c.fileName, dndIncludes)) {
      dnd.push(c)
    }
    if (chunkMatchesAnyInclude(c.fileName, modalIncludes)) {
      modal.push(c)
    }

    const isVendorByName =
      vendorNameIncludes.some((s) => c.name?.includes?.(s) || c.fileName.includes(s))
    const isVendorByModules = (c.nodeModulesRatio ?? 0) >= vendorRatio
    const isVendor = isVendorByName || isVendorByModules

    if (c.isEntry) {
      entry.push(c)
      continue
    }

    const facade = c.facadeModuleId ?? ''
    const isAsyncByFacade = asyncFacadeIncludes.some((s) => facade.includes(s))
    const isAsync = Boolean(c.isDynamicEntry) || isAsyncByFacade

    if (isVendor) vendor.push(c)
    else if (isAsync) asyncRoute.push(c)
    else other.push(c)
  }

  return { entry, vendor, asyncRoute, other, dnd, modal }
}

function budgetFail(message) {
  return { ok: false, message }
}

function budgetOk(message) {
  return { ok: true, message }
}

function compareBudgets({ groups, sizesByFile, budgets, metric }) {
  const results = []

  const entryMax = budgets.thresholds?.entry?.maxPerChunkBytes
  if (typeof entryMax === 'number') {
    for (const c of groups.entry) {
      const v = sizesByFile.get(c.fileName)?.[metric]
      if (typeof v !== 'number') continue
      results.push(
        v > entryMax
          ? budgetFail(`entry: ${c.fileName} ${bytes(v)} > ${bytes(entryMax)}`)
          : budgetOk(`entry: ${c.fileName} ${bytes(v)} <= ${bytes(entryMax)}`),
      )
    }
  }

  const vendorMaxPer = budgets.thresholds?.vendor?.maxPerChunkBytes
  if (typeof vendorMaxPer === 'number') {
    for (const c of groups.vendor) {
      const v = sizesByFile.get(c.fileName)?.[metric]
      if (typeof v !== 'number') continue
      results.push(
        v > vendorMaxPer
          ? budgetFail(`vendor: ${c.fileName} ${bytes(v)} > ${bytes(vendorMaxPer)}`)
          : budgetOk(`vendor: ${c.fileName} ${bytes(v)} <= ${bytes(vendorMaxPer)}`),
      )
    }
  }

  const vendorMaxTotal = budgets.thresholds?.vendor?.maxTotalBytes
  if (typeof vendorMaxTotal === 'number') {
    const total = groups.vendor.reduce((acc, c) => {
      const v = sizesByFile.get(c.fileName)?.[metric]
      return acc + (typeof v === 'number' ? v : 0)
    }, 0)
    results.push(
      total > vendorMaxTotal
        ? budgetFail(`vendor total: ${bytes(total)} > ${bytes(vendorMaxTotal)}`)
        : budgetOk(`vendor total: ${bytes(total)} <= ${bytes(vendorMaxTotal)}`),
    )
  }

  const asyncExclude = budgets.thresholds?.asyncRoute?.excludeFileNameIncludes ?? []
  const asyncMax = budgets.thresholds?.asyncRoute?.maxPerChunkBytes
  if (typeof asyncMax === 'number') {
    for (const c of groups.asyncRoute) {
      if (chunkMatchesAnyInclude(c.fileName, asyncExclude)) continue
      const v = sizesByFile.get(c.fileName)?.[metric]
      if (typeof v !== 'number') continue
      results.push(
        v > asyncMax
          ? budgetFail(`asyncRoute: ${c.fileName} ${bytes(v)} > ${bytes(asyncMax)}`)
          : budgetOk(`asyncRoute: ${c.fileName} ${bytes(v)} <= ${bytes(asyncMax)}`),
      )
    }
  }

  const dndMaxPer = budgets.thresholds?.dnd?.maxPerChunkBytes
  if (typeof dndMaxPer === 'number') {
    for (const c of groups.dnd) {
      const v = sizesByFile.get(c.fileName)?.[metric]
      if (typeof v !== 'number') continue
      results.push(
        v > dndMaxPer
          ? budgetFail(`dnd: ${c.fileName} ${bytes(v)} > ${bytes(dndMaxPer)}`)
          : budgetOk(`dnd: ${c.fileName} ${bytes(v)} <= ${bytes(dndMaxPer)}`),
      )
    }
  }

  const dndMaxTotal = budgets.thresholds?.dnd?.maxTotalBytes
  if (typeof dndMaxTotal === 'number') {
    const total = groups.dnd.reduce((acc, c) => {
      const v = sizesByFile.get(c.fileName)?.[metric]
      return acc + (typeof v === 'number' ? v : 0)
    }, 0)
    results.push(
      total > dndMaxTotal
        ? budgetFail(`dnd total: ${bytes(total)} > ${bytes(dndMaxTotal)}`)
        : budgetOk(`dnd total: ${bytes(total)} <= ${bytes(dndMaxTotal)}`),
    )
  }

  const modalMaxPer = budgets.thresholds?.modal?.maxPerChunkBytes
  if (typeof modalMaxPer === 'number') {
    for (const c of groups.modal) {
      const v = sizesByFile.get(c.fileName)?.[metric]
      if (typeof v !== 'number') continue
      results.push(
        v > modalMaxPer
          ? budgetFail(`modal: ${c.fileName} ${bytes(v)} > ${bytes(modalMaxPer)}`)
          : budgetOk(`modal: ${c.fileName} ${bytes(v)} <= ${bytes(modalMaxPer)}`),
      )
    }
  }

  return results
}

function toTableRows(chunks, sizesByFile, metric) {
  return chunks
    .map((c) => {
      const s = sizesByFile.get(c.fileName)?.[metric]
      return {
        file: c.fileName,
        name: c.name ?? '',
        metricBytes: typeof s === 'number' ? s : null,
        rawBytes: sizesByFile.get(c.fileName)?.raw ?? null,
      }
    })
    .sort((a, b) => (b.metricBytes ?? 0) - (a.metricBytes ?? 0))
}

function renderMarkdown({ metric, groups, sizesByFile, comparisons, manifest }) {
  const lines = []
  lines.push(`# Bundle budget report`)
  lines.push(``)
  lines.push(`- Metric: **${metric} bytes**`)
  lines.push(`- Generated: **${new Date().toISOString()}**`)
  lines.push(``)

  const entryFiles = Object.values(manifest ?? {})
    .filter((v) => v?.isEntry)
    .map((v) => v.file)
  lines.push(`## Entry points`)
  lines.push(`- Entries: ${uniq(entryFiles).map((f) => `\`${f}\``).join(', ') || '(none)'}`)
  lines.push(``)

  function section(title, chunks) {
    const rows = toTableRows(chunks, sizesByFile, metric)
    const total = rows.reduce((acc, r) => acc + (r.metricBytes ?? 0), 0)
    lines.push(`## ${title}`)
    lines.push(`- Total (${metric}): **${bytes(total)}**`)
    lines.push(``)
    lines.push(`| file | name | ${metric} | raw |`)
    lines.push(`|---|---:|---:|---:|`)
    for (const r of rows) {
      lines.push(
        `| \`${r.file}\` | \`${r.name}\` | ${r.metricBytes == null ? '-' : bytes(r.metricBytes)} | ${r.rawBytes == null ? '-' : bytes(r.rawBytes)} |`,
      )
    }
    lines.push(``)
  }

  section('Entry chunks', groups.entry)
  section('Vendor chunks', groups.vendor)
  section('Async route chunks', groups.asyncRoute)
  if (groups.dnd?.length) section('DnD chunks (@dnd-kit / sortable)', groups.dnd)
  if (groups.modal?.length) section('Modal chunks (lazy modals)', groups.modal)

  lines.push(`## Budget checks`)
  lines.push(``)
  const failed = comparisons.filter((c) => !c.ok)
  const passed = comparisons.filter((c) => c.ok)
  lines.push(`- Passed: **${passed.length}**`)
  lines.push(`- Failed: **${failed.length}**`)
  lines.push(``)
  if (failed.length) {
    lines.push(`### Failures`)
    for (const f of failed) lines.push(`- ${f.message}`)
    lines.push(``)
  }
  lines.push(`### All checks`)
  for (const c of comparisons) lines.push(`- ${c.ok ? 'OK' : 'FAIL'}: ${c.message}`)
  lines.push(``)

  return lines.join('\n')
}

async function main() {
  const [budgets, stats, manifest] = await Promise.all([
    readJson(budgetPath),
    readJson(statsPath),
    readJson(manifestPath).catch(() => ({})),
  ])

  const metric = pickMetric(budgets.measured)

  const chunks = stats.chunks ?? []
  const groups = classifyChunks({ chunks, budgets })

  const allChunkFiles = uniq(
    [
      ...groups.entry,
      ...groups.vendor,
      ...groups.asyncRoute,
      ...groups.other,
      ...groups.dnd,
      ...groups.modal,
    ].map((c) => c.fileName),
  )

  const sizesByFile = new Map()
  await Promise.all(
    allChunkFiles.map(async (fileName) => {
      const abs = path.join(distDir, fileName)
      const s = await measureFileSizes(abs)
      sizesByFile.set(fileName, {
        raw: s.rawBytes,
        gzip: s.gzipBytes,
        brotli: s.brotliBytes,
      })
    }),
  )

  const comparisons = compareBudgets({ groups, sizesByFile, budgets, metric })
  const reportMd = renderMarkdown({ metric, groups, sizesByFile, comparisons, manifest })

  const reportJson = {
    metric,
    generatedAt: new Date().toISOString(),
    groups: {
      entry: groups.entry.map((c) => c.fileName),
      vendor: groups.vendor.map((c) => c.fileName),
      asyncRoute: groups.asyncRoute.map((c) => c.fileName),
      other: groups.other.map((c) => c.fileName),
      dnd: groups.dnd.map((c) => c.fileName),
      modal: groups.modal.map((c) => c.fileName),
    },
    sizes: Object.fromEntries(
      [...sizesByFile.entries()].map(([k, v]) => [k, { raw: v.raw, gzip: v.gzip, brotli: v.brotli }]),
    ),
    checks: comparisons,
    ok: comparisons.every((c) => c.ok),
  }

  const reportMdPath = path.join(frontendRoot, 'bundle-report.md')
  const reportJsonPath = path.join(frontendRoot, 'bundle-report.json')
  await fs.writeFile(reportMdPath, reportMd, 'utf-8')
  await fs.writeFile(reportJsonPath, JSON.stringify(reportJson, null, 2) + '\n', 'utf-8')

  if (!reportJson.ok) {
    console.error('Bundle budget check FAILED. See frontend/bundle-report.md')
    process.exit(1)
  }

  console.log('Bundle budget check OK.')
  console.log(`Report: ${path.relative(process.cwd(), reportMdPath)}`)
}

try {
  await main()
} catch (e) {
  console.error(e?.stack || String(e))
  process.exit(1)
}

