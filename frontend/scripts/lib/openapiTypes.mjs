/**
 * Единственное место, где backend-приложение превращается в закоммиченный контракт
 * фронтенда: экспорт схемы пропиновым интерпретатором, проверка её формы и рендер
 * TypeScript-типов.
 *
 * Экспорт идёт во временный файл, а запись — в LF и через rename: непровалидированная
 * или частично записанная схема не может попасть в репозиторий, а переводы строк
 * хост-системы (core.autocrlf на Windows) не дают ложного drift.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import openapiTS, { astToString } from 'openapi-typescript'
import { describeInterpreter, repoRoot } from './openapiPython.mjs'

const generatedDir = path.join(repoRoot, 'frontend', 'src', 'shared', 'api', 'generated')
export const openapiJsonPath = path.join(generatedDir, 'openapi.json')
export const openapiTypesPath = path.join(generatedDir, 'openapi.d.ts')

/** Детерминированные входные данные экспорта: тестовое окружение, БД в памяти, фиктивные секреты. */
const exportEnv = {
    ENVIRONMENT: 'test',
    DEBUG: 'false',
    DATABASE_URL: 'sqlite+aiosqlite:///:memory:',
    SECRET_KEY: 'openapi-export-secret-key-32-chars',
    TELEGRAM_BOT_TOKEN: '0000000000:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    TELEGRAM_WEBAPP_URL: 'https://test.example.com',
}

function toLf(text) {
    return text.replace(/\r\n/g, '\n')
}

export function relativePath(filePath) {
    return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

/** Читает файл как LF-текст; null — файла нет. */
export async function readTextLf(filePath) {
    try {
        return toLf(await fs.readFile(filePath, 'utf-8'))
    } catch {
        return null
    }
}

/** Записывает LF-текст атомарно: временный файл рядом и rename поверх целевого. */
export async function writeTextLf(filePath, text) {
    const tmpPath = `${filePath}.tmp-${process.pid}`
    await fs.writeFile(tmpPath, toLf(text), 'utf-8')
    await fs.rename(tmpPath, filePath)
}

/**
 * Собирает контракт целиком и возвращает его артефакты в виде `{ role, path, text }` —
 * в том виде, в каком они должны лежать в репозитории. Список один и тот же для записи
 * и проверки, поэтому артефакт нельзя добавить в одном месте и забыть в другом, а роль
 * говорит проверке, к чему применимо правило «документ OpenAPI».
 */
export async function buildContract(python) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fittracker-openapi-'))
    try {
        const tmpSchemaPath = path.join(tmpDir, 'openapi.json')
        await exportSchema(tmpSchemaPath, python)

        const schemaText = toLf(await fs.readFile(tmpSchemaPath, 'utf-8'))
        const { document, problem } = inspectOpenApiDocument(schemaText)
        if (problem) {
            throw new Error(
                `The export produced an unusable OpenAPI document (${describeInterpreter(python)}): ${problem}. ` +
                    'No contract file was written.',
            )
        }

        return [
            { role: 'document', path: openapiJsonPath, text: schemaText },
            {
                role: 'types',
                path: openapiTypesPath,
                text: await generateTypes(document, `The OpenAPI export (${describeInterpreter(python)})`),
            },
        ]
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true })
    }
}

function exportSchema(outPath, python) {
    return new Promise((resolve, reject) => {
        const child = spawn(python.command, [...python.args, 'backend/tools/export_openapi.py', '--out', outPath], {
            cwd: repoRoot,
            stdio: 'inherit',
            env: { ...process.env, ...exportEnv },
        })
        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`OpenAPI export failed (exit ${code ?? 'unknown'}) using ${describeInterpreter(python)}`))
        })
    })
}

/**
 * Разбирает текст и говорит, пригоден ли он как документ OpenAPI: `{ document }` либо
 * `{ problem }` с причиной. Один владелец правила, поэтому свежий экспорт и закоммиченный
 * файл проверяются одинаково.
 */
export function inspectOpenApiDocument(text) {
    let document
    try {
        document = JSON.parse(text)
    } catch (error) {
        return { problem: `not valid JSON: ${error.message}` }
    }

    const problem = describeDocumentProblem(document)
    return problem ? { problem } : { document }
}

/** null — из документа соберётся контракт; иначе причина, которую видно в отчёте. */
function describeDocumentProblem(document) {
    if (typeof document?.openapi !== 'string' || !document.openapi.startsWith('3.')) {
        return `openapi is ${JSON.stringify(document?.openapi ?? null)} instead of a 3.x version string`
    }
    if (typeof document.info?.title !== 'string' || !document.info.title) return 'info.title is missing'

    const routes = Object.keys(document.paths ?? {})
    if (routes.length === 0) return 'paths has no entries'

    const malformed = routes.find((route) => !route.startsWith('/'))
    return malformed ? `paths contains a non-route key ${JSON.stringify(malformed)}` : null
}

/**
 * Типы для разобранного документа — единственный рендер, которым пользуются и сборка
 * контракта, и проверка пары закоммиченных артефактов. `source` называет документ в
 * сообщении: рендер отвергает и то, что не переживёт проверок `openapi-typescript`.
 */
export async function generateTypes(document, source) {
    try {
        const ast = await openapiTS(document, { exportType: true, immutableTypes: true })
        return astToString(ast).trimEnd() + '\n'
    } catch (error) {
        throw new Error(`${source} cannot be turned into types: ${error.message}`)
    }
}
