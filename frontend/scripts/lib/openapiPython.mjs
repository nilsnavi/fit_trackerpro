/**
 * Пропиновый Python для экспорта OpenAPI.
 *
 * Схему выдаёт импорт backend-приложения, поэтому её определяют версии FastAPI и
 * Pydantic. Любой `python` из PATH — это лотерея: он молча печатает другую схему,
 * и это выглядит как ложный drift (`api:contract:check`) либо затирает корректный
 * сгенерированный файл (`api:types:generate`).
 *
 * Поэтому здесь возвращается только тот интерпретатор, чьи версии совпадают с
 * пинами `backend/requirements.txt` — того же файла, который ставит CI. Если
 * совпадений нет, окружение поднимается самостоятельно.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

/** Корень репозитория — от файла, а не от cwd: скрипты работают из любого каталога. */
export const repoRoot = path.resolve(scriptDir, '..', '..', '..')

const backendDir = path.join(repoRoot, 'backend')
/** Единственный источник пинов: файл, который CI ставит перед проверкой контракта. */
const requirementsPath = path.join(backendDir, 'requirements.txt')
/** Окружение, которое модуль поднимает сам. Игнорируется git и docker-контекстом. */
const managedVenvDir = path.join(backendDir, '.venv-openapi')
/** Готовые окружения: используются, если их пины уже совпадают. */
const reusableVenvDirs = [
    managedVenvDir,
    path.join(backendDir, '.venv'),
    path.join(backendDir, 'venv'),
    path.join(repoRoot, '.venv'),
]

const COMMAND_TIMEOUT_MS = 2 * 60_000
const INSTALL_TIMEOUT_MS = 15 * 60_000

/**
 * Печатает JSON-отчёт о пинах, полученных на stdin: чего не хватает, что другой
 * версии и какие версии реально стоят. Один процесс — одна проверка всего набора.
 */
const PIN_PROBE = `import json, sys
from importlib import metadata

pins = json.load(sys.stdin)
missing = []
mismatched = []
for name, expected in pins.items():
    try:
        actual = metadata.version(name)
    except metadata.PackageNotFoundError:
        missing.append(name)
    else:
        if actual != expected:
            mismatched.append(f"{name}: want {expected}, have {actual}")

versions = {}
for name in ("fastapi", "pydantic"):
    try:
        versions[name] = metadata.version(name)
    except metadata.PackageNotFoundError:
        pass

print(json.dumps({
    "executable": sys.executable,
    "python": sys.version.split()[0],
    "missing": missing,
    "mismatched": mismatched,
    "versions": versions,
}))`

/**
 * Запускает команду и собирает вывод. Отсутствие исполняемого файла, ненулевой код
 * и таймаут — это просто неудача кандидата, а не падение всей проверки.
 */
function run(command, args, { input, stdio = 'pipe', timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
    return new Promise((resolve) => {
        let child
        try {
            child = spawn(command, args, { stdio: [input === undefined ? 'ignore' : 'pipe', stdio, stdio] })
        } catch (error) {
            resolve({ ok: false, error })
            return
        }

        let stdout = ''
        let stderr = ''
        let settled = false
        const finish = (result) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(result)
        }
        const timer = setTimeout(() => {
            child.kill('SIGKILL')
            finish({ ok: false, error: new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`) })
        }, timeoutMs)

        child.stdout?.on('data', (chunk) => {
            stdout += chunk
        })
        child.stderr?.on('data', (chunk) => {
            stderr += chunk
        })
        child.on('error', (error) => finish({ ok: false, error }))
        child.on('close', (code) => finish({ ok: code === 0, code, stdout, stderr }))

        if (child.stdin) {
            child.stdin.on('error', () => {})
            child.stdin.end(input)
        }
    })
}

/** Все `==`-пины, достижимые от файла требований, вместе с `-r`-включениями. */
export async function readPinnedRequirements(filePath = requirementsPath) {
    const pins = new Map()
    await collectPins(path.resolve(filePath), pins, new Set())
    return pins
}

async function collectPins(filePath, pins, seen) {
    if (seen.has(filePath)) return
    seen.add(filePath)

    let text
    try {
        text = await fs.readFile(filePath, 'utf-8')
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(
            `Cannot read requirements file ${displayPath(filePath)}: ${reason}. ` +
                'Pinned environment resolution is fail-closed; missing or unreadable ' +
                'requirements (including recursive -r includes) must not be skipped.',
        )
    }

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, '').trim()
        if (!line) continue

        const include = /^(?:-r|--requirement)[ =](\S+)$/.exec(line)
        if (include) {
            await collectPins(path.resolve(path.dirname(filePath), include[1]), pins, seen)
            continue
        }
        if (line.startsWith('-')) continue

        const pin = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*==\s*([\w.+-]+)$/.exec(line)
        if (pin) pins.set(pin[1].toLowerCase(), pin[2])
    }
}

/** Отчёт о пинах для одного интерпретатора; null — интерпретатор недоступен. */
async function inspect(command, args, pins) {
    const result = await run(command, [...args, '-c', PIN_PROBE], {
        input: JSON.stringify(Object.fromEntries(pins)),
    })
    if (!result.ok) return null

    try {
        return JSON.parse(result.stdout.trim().split('\n').pop())
    } catch {
        return null
    }
}

function matchesPins(report) {
    return Boolean(report) && report.missing.length === 0 && report.mismatched.length === 0
}

function describeDifferences(report) {
    if (!report) return 'the interpreter did not answer'
    const parts = [...report.mismatched, ...report.missing.map((name) => `${name}: not installed`)]
    return parts.join('; ') || 'unknown difference'
}

/** Путь для логов: от корня репозитория и всегда через `/`, независимо от ОС. */
function displayPath(filePath) {
    return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

/** Однострочное описание для логов: источник, версии-драйверы схемы, Python. */
export function describeInterpreter(python) {
    const details = python.report ? [`Python ${python.report.python}`] : []
    for (const [name, version] of Object.entries(python.report?.versions ?? {})) {
        details.push(`${name} ${version}`)
    }
    return details.length ? `${python.source} — ${details.join(', ')}` : python.source
}

/** Кандидаты базовых интерпретаторов: ими создаётся venv, пины у них не важны. */
function baseCandidates() {
    const candidates = [['python'], ['python3']]
    if (process.platform === 'win32') candidates.push(['py', '-3'])
    return candidates
}

function venvExecutable(venvDir) {
    return process.platform === 'win32'
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python')
}

async function isFile(filePath) {
    try {
        return (await fs.stat(filePath)).isFile()
    } catch {
        return false
    }
}

/**
 * Возвращает интерпретатор, чьи пины совпадают с `backend/requirements.txt`.
 * Порядок: OPENAPI_PYTHON → готовые venv репозитория → python из PATH →
 * самостоятельный провижн. Если ничего не вышло — исключение, и ни один файл
 * контракта не тронут.
 */
export async function resolvePinnedPython({ log = console.log } = {}) {
    const pins = await readPinnedRequirements()

    const override = process.env.OPENAPI_PYTHON
    if (override) {
        log(`! OPENAPI_PYTHON is set: using ${override} without checking it against the backend/requirements.txt pins.`)
        return { command: override, args: [], source: `OPENAPI_PYTHON=${override}` }
    }

    const rejected = []
    for (const venvDir of reusableVenvDirs) {
        const executable = venvExecutable(venvDir)
        if (!(await isFile(executable))) continue

        const report = await inspect(executable, [], pins)
        if (matchesPins(report)) {
            return { command: executable, args: [], source: displayPath(venvDir), report }
        }
        rejected.push(`${displayPath(venvDir)}: ${describeDifferences(report)}`)
    }

    for (const args of baseCandidates()) {
        const report = await inspect(args[0], args.slice(1), pins)
        if (matchesPins(report)) {
            return { command: args[0], args: args.slice(1), source: `${args.join(' ')} from PATH`, report }
        }
    }

    return provision(pins, { log, rejected })
}

async function provision(pins, { log, rejected }) {
    const bases = []
    for (const args of baseCandidates()) {
        const report = await inspect(args[0], args.slice(1), pins)
        if (!report) continue
        if (!bases.some((base) => base.report.executable === report.executable)) {
            bases.push({ args, report })
        }
    }

    if (bases.length === 0) {
        throw new Error(
            [
                'No Python interpreter found to build the pinned environment.',
                ...rejected.map((line) => `  - rejected ${line}`),
                'Install Python 3.12+, or point OPENAPI_PYTHON at an interpreter that satisfies backend/requirements.txt.',
                'Nothing was exported, so the committed OpenAPI files are untouched.',
            ].join('\n'),
        )
    }

    const failures = []
    for (const { args, report } of bases) {
        const label = args.join(' ')
        log(
            `No environment matches the backend/requirements.txt pins — provisioning ` +
                `${displayPath(managedVenvDir)} with Python ${report.python} (one-time install).`,
        )

        const created = await run(args[0], [...args.slice(1), '-m', 'venv', '--clear', managedVenvDir])
        if (!created.ok) {
            failures.push(`${label}: venv creation failed (${created.error?.message ?? `exit ${created.code}`})`)
            continue
        }

        const executable = venvExecutable(managedVenvDir)
        const installed = await run(
            executable,
            ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '-r', requirementsPath],
            { stdio: 'inherit', timeoutMs: INSTALL_TIMEOUT_MS },
        )
        if (!installed.ok) {
            failures.push(`${label}: dependency install failed (${installed.error?.message ?? `exit ${installed.code}`})`)
            continue
        }

        const installedReport = await inspect(executable, [], pins)
        if (matchesPins(installedReport)) {
            return {
                command: executable,
                args: [],
                source: `${displayPath(managedVenvDir)} (provisioned)`,
                report: installedReport,
            }
        }
        failures.push(`${label}: provisioned environment does not match the pins — ${describeDifferences(installedReport)}`)
    }

    throw new Error(
        [
            'Could not obtain an environment pinned to backend/requirements.txt; nothing was exported.',
            ...[...rejected, ...failures].map((line) => `  - ${line}`),
            'Check access to the package index, or point OPENAPI_PYTHON at a suitable interpreter.',
        ].join('\n'),
    )
}
