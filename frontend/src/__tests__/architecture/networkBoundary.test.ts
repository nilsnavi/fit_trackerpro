import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ts from 'typescript'

/**
 * Архитектурная граница сетевого слоя: у него есть владельцы, и никто больше не ходит в сеть сам.
 *
 * Политика здесь не описана, а прочитана — владельцы и запрещённые модули объявлены один раз в
 * `architecture/networkBoundary.policy.cjs`, откуда их берёт и конфиг ESLint (`frontend/.eslintrc.cjs`).
 * Этот гвард обходит AST и проверяет то же самое на всём дереве, поэтому список правил нельзя
 * поправить в конфиге и забыть здесь.
 *
 * - **Ни один компонент не владеет сетью.** Запись и запросы живут в хуках-владельцах
 *   (`useWorkoutSetWrites`, `useLoadTables`, `useOnboardingSubmit`), чтение очереди — в читающей
 *   поверхности `useSyncQueue`; прямой `fetch` в компоненте запрещён так же, как импорт клиента.
 * - **Сетевой слой импортируют только явные владельцы.** Доменные клиенты вместе с общими
 *   доступны хукам, страницам, самому слою `api/` и бутстрапу `app/`; движок очереди — только
 *   слою очереди, читающей поверхности и провайдеру. Исключений из этих списков нет.
 *
 * Тип-онли импорты (`import type { SyncQueueItem }`) разрешены: они стираются при сборке и не
 * создают рантайм-связи с сетевым слоем.
 */
const policy = require('../../../architecture/networkBoundary.policy.cjs')

const SRC_ROOT = path.resolve(__dirname, '..', '..')

// ─────────────────────────── чтение импортов ───────────────────────────

interface ModuleImports {
    /** Модули из `import … from '…'`, `export … from '…'` и `import('…')`, без тип-онли. */
    modules: string[]
    /** Значения из секции `{ … }` всех импортов. */
    names: string[]
    /** Импорты модуля целиком (`import * as X`, default) — дают доступ ко всем его экспортам. */
    wholeModules: string[]
    /** Прямые вызовы сети в самом файле: `fetch(…)`, `new XMLHttpRequest()`. */
    networkCalls: string[]
}

interface Violation {
    file: string
    specifier: string
    reason: string
}

function relativeToSource(fileName: string): string {
    return path.relative(SRC_ROOT, fileName).split(path.sep).join('/')
}

/** Путь нарушителя: абсолютный приводим к src-относительному, относительный берём как есть. */
function asSourceFile(fileName: string): string {
    return path.isAbsolute(fileName) ? relativeToSource(fileName) : fileName.split(path.sep).join('/')
}

/** `import type { X }` и `import { type X }` — связь только на уровне типов. */
function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
    const clause = node.importClause
    if (!clause) return false
    if (clause.isTypeOnly) return true
    const bindings = clause.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) return false
    return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)
}

/** Имя вызываемого: `fetch(…)` или `window.fetch(…)`. */
function calleeName(expression: ts.Expression): string | null {
    if (ts.isIdentifier(expression)) return expression.text
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name)) return expression.name.text
    return null
}

function readImports(sourceText: string, fileName: string): ModuleImports {
    const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const modules: string[] = []
    const names: string[] = []
    const wholeModules: string[] = []
    const networkCalls: string[] = []

    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !isTypeOnlyImport(node)) {
            const specifier = node.moduleSpecifier.text
            modules.push(specifier)
            const clause = node.importClause
            if (clause?.name || clause?.namedBindings === undefined || ts.isNamespaceImport(clause.namedBindings)) {
                wholeModules.push(specifier)
            }
            const bindings = clause?.namedBindings
            if (bindings && ts.isNamedImports(bindings)) {
                bindings.elements.forEach((element) => {
                    if (!element.isTypeOnly) names.push(element.name.text)
                })
            }
        }
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            modules.push(node.moduleSpecifier.text)
        }
        // `import('./X')` — ленивые чанки компонентов.
        if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1 &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            modules.push(node.arguments[0].text)
        }
        if (ts.isCallExpression(node)) {
            const name = calleeName(node.expression)
            if (name && policy.NETWORK_GLOBAL_CALLS.includes(name)) networkCalls.push(name)
        }
        if (
            ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            policy.NETWORK_GLOBAL_CALLS.includes(node.expression.text)
        ) {
            networkCalls.push(node.expression.text)
        }
        ts.forEachChild(node, visit)
    }

    visit(source)
    return { modules, names, wholeModules, networkCalls }
}

function filesIn(relativeDir: string): string[] {
    const dir = path.join(SRC_ROOT, relativeDir)
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = path.join(relativeDir, entry.name)
        // Тесты вправе мокать сеть — они не охраняются.
        if (entry.isDirectory()) return policy.isTestPath(relative) ? [] : filesIn(relative)
        if (!/\.tsx?$/.test(entry.name) || policy.isTestPath(relative)) return []
        return [path.join(dir, entry.name)]
    })
}

function readFileImports(fileName: string): ModuleImports {
    return readImports(fs.readFileSync(fileName, 'utf8'), fileName)
}

// ───────────────── правило 1: компоненты не владеют сетью ─────────────────

/** Нарушения правила 1 в файле; пусто — файл чист. */
function findComponentViolations(fileName: string, sourceText: string): Violation[] {
    const { modules, names, networkCalls } = readImports(sourceText, fileName)
    const file = asSourceFile(fileName)
    const violations: Violation[] = []

    modules.forEach((specifier) => {
        policy.componentModuleViolations(specifier).forEach((reason: string) => {
            violations.push({ file, specifier, reason })
        })
    })
    names.forEach((name: string) => {
        if (policy.QUERY_IMPORT_NAMES.includes(name)) {
            violations.push({ file, specifier: name, reason: policy.RULES.importedQuery.reason })
        }
    })
    networkCalls.forEach((call) => {
        violations.push({ file, specifier: `${call}()`, reason: policy.RULES.directNetwork.reason })
    })
    return violations
}

// ───────── правило 2: у сетевого слоя есть явные владельцы ─────────

/** Нарушения правила 2 в файле; пусто — владение соблюдено. */
function findOwnershipViolations(fileName: string, sourceText: string): Violation[] {
    const imports = readImports(sourceText, fileName)
    const file = asSourceFile(fileName)
    const violations: Violation[] = []

    if (!policy.isQueueEngineOwner(file) && policy.queueEngineAccess(imports)) {
        violations.push({ file, specifier: 'getSyncQueueEngine', reason: policy.RULES.queueEngineOwnership.reason })
    }

    if (!policy.isApiClientOwner(file)) {
        imports.modules.forEach((module) => {
            if (policy.isApiClientModule(module)) {
                violations.push({ file, specifier: module, reason: policy.RULES.apiClientOwnership.reason })
            }
        })
    }

    return violations
}

// ─────────────────────────────── проверки ───────────────────────────────

describe('компоненты не владеют сетью', () => {
    const files = filesIn('.').filter((file) => policy.isComponentPath(relativeToSource(file)))

    it('находит компоненты всех слоёв, а не пустой список', () => {
        const found = files.map(relativeToSource)
        expect(found.length).toBeGreaterThan(80)
        expect(found).toEqual(expect.arrayContaining([
            'features/workouts/active/components/ActiveWorkoutScreen.tsx',
            'app/components/ConnectivitySyncBar.tsx',
            'features/analytics/components/MuscleLoadTable.tsx',
            'features/emergency/components/EmergencyContactsSection.tsx',
            'features/auth/components/TelegramAuthBootstrapGate.tsx',
            'components/Onboarding/OnboardingScreen.tsx',
        ]))
    })

    it('ни один компонент не импортирует сетевые модули, мутации и не зовёт сеть напрямую', () => {
        const violations = files.flatMap((file) =>
            findComponentViolations(file, fs.readFileSync(file, 'utf8')),
        )
        expect(violations).toEqual([])
    })

    it('каждый компонент делегирует сеть своему владельцу', () => {
        const namesIn = (relative: string) =>
            readFileImports(path.join(SRC_ROOT, relative)).names

        expect(namesIn('features/workouts/active/components/WorkoutSyncQueueStatus.tsx'))
            .toContain('useSyncQueue')
        expect(namesIn('features/workouts/active/components/ActiveWorkoutScreen.tsx'))
            .toContain('useWorkoutSetWrites')
        expect(namesIn('components/TelegramAuthGate.tsx'))
            .toContain('useTelegramAuthExchange')
        expect(namesIn('features/analytics/components/MuscleLoadTable.tsx'))
            .toContain('useMuscleLoadTable')
        expect(namesIn('features/analytics/components/TrainingLoadTable.tsx'))
            .toContain('useTrainingLoadDailyTable')
        expect(namesIn('components/Onboarding/OnboardingScreen.tsx'))
            .toContain('useOnboardingSubmit')
        expect(namesIn('features/auth/components/TelegramAuthBootstrapGate.tsx'))
            .toContain('fetchCurrentUserProfile')
    })
})

describe('сетевой слой принадлежит явным владельцам', () => {
    const files = filesIn('.')

    it('список владельцев очереди обоснован и не устарел', () => {
        const owners = policy.QUEUE_ENGINE_OWNERS
        expect(owners.length).toBeGreaterThan(0)
        owners.forEach(({ path: ownerPath, why }: { path: string; why: string }) => {
            expect(why.length).toBeGreaterThan(10)
            const matching = files.filter((file) => policy.isQueueEngineOwner(relativeToSource(file)) && policy.isOwnerPath(relativeToSource(file), ownerPath))
            expect(matching.length).toBeGreaterThan(0)
        })

        // Файлы-владельцы обязаны действительно брать движок: иначе запись устарела.
        const fileOwners = owners.filter((owner: { path: string }) => !owner.path.endsWith('/'))
        fileOwners.forEach((owner: { path: string }) => {
            const file = path.join(SRC_ROOT, owner.path)
            expect(policy.queueEngineAccess(readFileImports(file))).not.toBeNull()
        })
    })

    it('посторонние файлы не берут движок очереди', () => {
        const violations = files.flatMap((file) =>
            findOwnershipViolations(file, fs.readFileSync(file, 'utf8')),
        )
        expect(violations).toEqual([])
    })
})

describe('политика одна для конфига ESLint и гварда', () => {
    it('каждое правило описано и имеет представителя для проверок', () => {
        const descriptors = [...policy.COMPONENT_FORBIDDEN_MODULES, ...policy.API_CLIENT_MODULES]
        expect(descriptors.length).toBeGreaterThan(5)

        descriptors.forEach((descriptor) => {
            const rule = policy.RULES[descriptor.rule]
            expect(rule.reason.length).toBeGreaterThan(3)
            expect(rule.hint.length).toBeGreaterThan(20)
            // Представитель обязан подпадать под своё же правило: иначе тест конфига его не поймает.
            expect(policy.matchesSpecifier(descriptor, descriptor.example)).toBe(true)
        })

        // Каждая подсказка доходит до ESLint: правило, описанное и нигде не применённое,
        // вводит в заблуждение (и ровно так расходятся конфиг и гвард).
        const eslintRules = JSON.stringify([
            policy.COMPONENT_IMPORTS,
            policy.COMPONENT_IMPORT_NAME_RULE,
            policy.COMPONENT_GLOBAL_RULE,
            policy.COMPONENT_GLOBAL_PROPERTY_RULE,
            policy.API_CLIENT_IMPORTS,
            policy.QUEUE_ENGINE_IMPORTS,
            policy.API_CLIENT_AND_QUEUE_IMPORTS,
        ])
        Object.keys(policy.RULES).forEach((key: string) => {
            expect(eslintRules).toContain(policy.RULES[key].hint)
        })
    })

    it('у каждого владельца есть глоб и предикат, описывающие одни и те же файлы', () => {
        const apiOwners = policy.API_CLIENT_OWNERS
        const queueOwners = policy.QUEUE_ENGINE_OWNERS

        expect(policy.API_CLIENT_OWNER_GLOBS).toHaveLength(apiOwners.length)
        expect(policy.QUEUE_ENGINE_OWNER_GLOBS).toHaveLength(queueOwners.length)
        ;[...policy.API_CLIENT_OWNER_GLOBS, ...policy.QUEUE_ENGINE_OWNER_GLOBS].forEach((glob: string) => {
            expect(glob.startsWith('src/')).toBe(true)
        })

        // Путь-владелец принимает файл под собой — и в гварде (предикат), и в конфиге (глоб).
        apiOwners.forEach((owner: string) => expect(policy.isApiClientOwner(insideOwner(owner))).toBe(true))
        queueOwners.forEach(({ path: owner }: { path: string }) => expect(policy.isQueueEngineOwner(insideOwner(owner))).toBe(true))
    })
})

/** Представитель файла под путём-владельцем: `<путь>/sample.ts`, а для файла — он сам. */
function insideOwner(ownerPath: string): string {
    if (/\.tsx?$/.test(ownerPath)) return ownerPath
    const dir = ownerPath.replace(/^\*\*\//, '').replace(/\/$/, '')
    return ownerPath.startsWith('**/') ? `features/widgets/${dir}/sample.ts` : `${dir}/sample.ts`
}

describe('сам детектор', () => {
    it('ловит сеть в подставленном исходнике компонента', () => {
        const synthetic = [
            "import { useMutation, useQueryClient } from '@tanstack/react-query'",
            "import { workoutsApi } from '@shared/api/domains/workoutsApi'",
            "import { patchWorkoutSet } from '../../api/workouts.api'",
            "import { enqueueOfflineWorkoutSetUpdate } from '@shared/offline/workoutOfflineEnqueue'",
            "import { authApi } from '@features/profile/api/authApi'",
            "const card = lazy(() => import('./ProgressionRecommendationCard'))",
            "const run = () => fetch('/api/v1/users')",
            'const xml = new XMLHttpRequest()',
        ].join('\n')

        const violations = findComponentViolations('synthetic.tsx', synthetic)
        expect(violations.map(({ specifier, reason }) => `${specifier} — ${reason}`)).toEqual([
            '@tanstack/react-query — react-query',
            '@shared/api/domains/workoutsApi — клиент API',
            '../../api/workouts.api — клиент API',
            '@shared/offline/workoutOfflineEnqueue — офлайн-очередь',
            '@features/profile/api/authApi — клиент API',
            'useMutation — мутация/запрос',
            'useQueryClient — мутация/запрос',
            'fetch() — прямой вызов сети',
            'XMLHttpRequest() — прямой вызов сети',
        ])
        // Ленивый чанк самого компонента остаётся разрешённым.
        expect(findComponentViolations('lazy.tsx', "import('./ProgressionRecommendationCard')")).toEqual([])
    })

    it('разрешает тип-онли импорты и ловит смешанные', () => {
        expect(findComponentViolations(
            'types.tsx',
            "import type { SyncQueueItem } from '@shared/offline/syncQueue'\n" +
                "import { type WorkoutSetResponse } from '@shared/api/domains/workoutsApi'\n" +
                "import type { ApiMuscleLoadTableEntry } from '@features/analytics/api/analyticsDomain'",
        )).toEqual([])

        const mixed = findComponentViolations(
            'mixed.tsx',
            "import { type UseMutationResult, useMutation } from '@tanstack/react-query'\n" +
                "import { type FitnessGoal, authApi } from '@features/profile/api/authApi'",
        )
        // Смешанный импорт несёт значение — модуль остаётся запрещённым; чисто тип-онли стирается.
        expect(mixed.map(({ specifier }) => specifier)).toEqual([
            '@tanstack/react-query',
            '@features/profile/api/authApi',
            'useMutation',
        ])
    })

    it('ловит прямой вызов сети и не путает его с похожими именами', () => {
        const calls = (source: string) =>
            findComponentViolations('net.tsx', source).map(({ specifier }) => specifier)

        expect(calls("window.fetch('/api/v1/x')")).toEqual(['fetch()'])
        expect(calls('new XMLHttpRequest()')).toEqual(['XMLHttpRequest()'])
        // Локальный хелпер и `refetch()` — не сеть.
        expect(calls('const reload = () => refetch()')).toEqual([])
        expect(calls("const error = clientErrorFromFetchResponse(response)")).toEqual([])
    })

    it('на настоящем файле владельца запрет компонентов срабатывает', () => {
        const owner = 'features/workouts/active/hooks/useWorkoutSetWrites.ts'
        const reasons = findComponentViolations(path.join(SRC_ROOT, owner), fs.readFileSync(path.join(SRC_ROOT, owner), 'utf8'))
            .map(({ specifier, reason }) => `${specifier} — ${reason}`)

        expect(reasons).toEqual(expect.arrayContaining([
            '@tanstack/react-query — react-query',
            '@shared/api/domains/workoutsApi — клиент API',
            '@shared/offline/syncQueue — офлайн-очередь',
        ]))
    })

    it('ловит попытку взять движок очереди в обход читающей поверхности', () => {
        const outsider = 'features/analytics/components/MuscleLoadTable.tsx'

        expect(findOwnershipViolations(
            outsider,
            "import { getSyncQueueEngine } from '@shared/offline/syncQueue'",
        )).toHaveLength(1)
        // Импорт всего модуля обходит проверку имён — и всё равно ловится.
        expect(findOwnershipViolations(outsider, "import * as syncQueue from '@shared/offline/syncQueue'")).toHaveLength(1)
        expect(findOwnershipViolations(outsider, "import { getSyncQueueEngine } from '@shared/offline/syncQueue/engine'")).toHaveLength(1)
        // Обычные помощники очереди владельцу не нужны только для движка — они не запрещены.
        expect(findOwnershipViolations(
            'features/workouts/active/hooks/useWorkoutSetWrites.ts',
            "import { isRecoverableSyncError } from '@shared/offline/syncQueue'",
        )).toEqual([])
        // Владельцы берут движок свободно.
        expect(findOwnershipViolations('shared/hooks/useSyncQueue.ts', "import { getSyncQueueEngine } from '@shared/offline/syncQueue'")).toEqual([])
        expect(findOwnershipViolations('app/providers/SyncQueueRunner.tsx', "import { getSyncQueueEngine } from '@shared/offline/syncQueue'")).toEqual([])
    })

    it('ловит клиент API в компоненте и пропускает его у владельца', () => {
        const sharedClient = "import { api } from '@shared/api/client'"
        const domainClient = "import { authApi } from '@features/profile/api/authApi'"

        expect(findOwnershipViolations('features/analytics/components/Card.tsx', sharedClient)).toHaveLength(1)
        // Гейт авторизации — обычный компонент: клиент ему недоступен, как и любому другому.
        expect(findOwnershipViolations('components/TelegramAuthGate.tsx', sharedClient)).toHaveLength(1)
        expect(findOwnershipViolations('features/analytics/components/MuscleLoadTable.tsx', domainClient)).toHaveLength(1)
        expect(findOwnershipViolations('components/Onboarding/OnboardingScreen.tsx', domainClient)).toHaveLength(1)

        // Относительный заход в каталог api — тот же клиент, что и алиас.
        expect(findOwnershipViolations(
            'features/analytics/lib/helpers.ts',
            "import { getAnalyticsMuscleLoadTable } from '../api/analyticsDomain'",
        )).toHaveLength(1)
        expect(findOwnershipViolations(
            'features/workouts/active/hooks/useWorkoutSetWrites.ts',
            "import { workoutsApi } from '../api/workouts.api'",
        )).toEqual([])
        expect(findOwnershipViolations('features/analytics/lib/helpers.ts', "import { cn } from '@shared/lib/cn'")).toEqual([])

        // Владельцы доменных клиентов — хуки, страницы, слой api и бутстрап.
        expect(findOwnershipViolations('hooks/useOnboardingSubmit.ts', domainClient)).toEqual([])
        expect(findOwnershipViolations('hooks/useTelegramAuthExchange.ts', sharedClient)).toEqual([])
        expect(findOwnershipViolations('features/analytics/hooks/useLoadTables.ts', domainClient)).toEqual([])
        expect(findOwnershipViolations('features/analytics/pages/RecoveryPage.tsx', domainClient)).toEqual([])
        expect(findOwnershipViolations('features/analytics/api/analyticsDomain.ts', sharedClient)).toEqual([])
        expect(findOwnershipViolations('features/profile/api/authApi.ts', sharedClient)).toEqual([])
        expect(findOwnershipViolations('shared/api/domains/usersApi.ts', sharedClient)).toEqual([])

        // Тип-онли импорт доменного клиента компоненту не запрещён: связи в рантайме нет.
        expect(findOwnershipViolations(
            'features/analytics/components/PREventCard.tsx',
            "import type { ApiProgressInsightsPRItem } from '@features/analytics/api/analyticsDomain'",
        )).toEqual([])
        // Ключи запросов и типы — не клиент, их можно брать где угодно.
        expect(findOwnershipViolations('features/analytics/components/Card.tsx', "import { queryKeys } from '@shared/api/queryKeys'")).toEqual([])
    })
})
