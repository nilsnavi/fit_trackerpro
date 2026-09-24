/* eslint-env node -- модуль CommonJS: `module.exports` — глобал Node, а не браузера */
/**
 * ─── Политика границы сетевого слоя (SPEC-005) ───
 *
 * Единственный источник истины о том, кто владеет сетью и что запрещено остальным. Читают её
 * обе стороны: конфиг ESLint (`frontend/.eslintrc.cjs`), падающий в момент написания импорта, и
 * архитектурные гварды (`frontend/src/__tests__/architecture/`), ловящие то же в конце прогона.
 * Владельцы и запрещённые модули объявлены здесь один раз, а нужные каждой стороне
 * представления выводятся из этих описаний — поэтому расхождение между конфигом и гвардом
 * невозможно: список нельзя поправить в одном месте и забыть в другом.
 *
 * Модуль намеренно CommonJS (`.cjs`, а не TypeScript): конфиг ESLint — CJS и обязан требовать его
 * синхронно, тесты берут тот же файл через `require`.
 *
 * Формулировок правила две, спецификация одна: ESLint понимает глобы, гвард обходит AST и
 * сравнивает регулярками. `eslintGlobs` и `matchesSpecifier` выводят оба представления из
 * одного описания (`module` / `moduleTemplate` / `pathSegment` / `relativeDir`).
 */

'use strict'

// ───────────────────────────────── пути ─────────────────────────────────

const EXTENSIONS = ['ts', 'tsx']

/** Компонент — любой файл под каталогом `components/`, в каком бы слое он ни лежал. */
const COMPONENT_DIR = 'components'

/** Тесты вправе мокать сеть — они вне границы. */
const TEST_DIR = '__tests__'
const TEST_SUFFIXES = ['.test.', '.spec.']

const COMPONENT_GLOBS = EXTENSIONS.map((ext) => `src/**/${COMPONENT_DIR}/**/*.${ext}`)
const TEST_GLOBS = [
    `**/${TEST_DIR}/**`,
    ...EXTENSIONS.flatMap((ext) => TEST_SUFFIXES.map((suffix) => `**/*${suffix}${ext}`)),
]
const SOURCE_GLOBS = EXTENSIONS.map((ext) => `src/**/*.${ext}`)

function normalizePath(value) {
    return value.split('\\').join('/')
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isComponentPath(relativePath) {
    return new RegExp(`(^|/)${COMPONENT_DIR}/`).test(normalizePath(relativePath))
}

function isTestPath(relativePath) {
    const relative = normalizePath(relativePath)
    if (relative.split('/').includes(TEST_DIR)) return true
    return TEST_SUFFIXES.some((suffix) => EXTENSIONS.some((ext) => relative.endsWith(`${suffix}${ext}`)))
}

// ──────────────────────────────── правила ────────────────────────────────

/**
 * Одна запись на правило границы: `reason` называет нарушение в гварде, `hint` печатает ESLint
 * разработчику. Обе строки живут рядом, потому что описывают одно и то же правило.
 */
const RULES = {
    reactQuery: {
        reason: 'react-query',
        hint: 'Сеть — не дело компонента: запросы и мутации живут в хуке-владельце.',
    },
    apiClient: {
        reason: 'клиент API',
        hint: 'Клиент API — не дело компонента: возьми данные через хук-владелец.',
    },
    offline: {
        reason: 'офлайн-очередь',
        hint: 'Офлайн-очередь — не дело компонента: читай её через useSyncQueue.',
    },
    httpClient: {
        reason: 'HTTP-клиент',
        hint: 'Прямой HTTP-клиент обходит сетевой слой: используй клиент API в хуке-владельце.',
    },
    importedQuery: {
        reason: 'мутация/запрос',
        hint: 'Запрос или мутация вне хука-владельца: возьми готовый хук.',
    },
    directNetwork: {
        reason: 'прямой вызов сети',
        hint: 'Прямой вызов сети обходит сетевой слой: делегируй хуку-владельцу.',
    },
    apiClientOwnership: {
        reason: 'клиент API — не владелец',
        hint: 'Клиенты API берут только владельцы: хуки, страницы, слой api и бутстрап app.',
    },
    queueEngineOwnership: {
        reason: 'движок очереди — не владелец',
        hint: 'Движок очереди берут только владельцы: слой очереди, useSyncQueue и SyncQueueRunner.',
    },
}

/**
 * Описание запрещённого модуля, а не его конкретное представление:
 * - `module` — сам модуль и его подпути;
 * - `moduleTemplate` — шаблон, где `*` — ровно один сегмент пути;
 * - `pathSegment` — любой путь, в котором есть такой сегмент;
 * - `relativeDir` — относительный заход в каталог с таким именем.
 * `example` — представитель модуля для тестов: добавил правило, получил и его покрытие.
 */
const COMPONENT_FORBIDDEN_MODULES = [
    { rule: 'reactQuery', module: '@tanstack/react-query', example: '@tanstack/react-query' },
    { rule: 'httpClient', module: 'axios', example: 'axios' },
    { rule: 'apiClient', pathSegment: 'api', example: '@shared/api/domains/workoutsApi' },
    { rule: 'offline', pathSegment: 'offline', example: '@shared/offline/workoutOfflineEnqueue' },
]

/** Клиенты API: общий и доменный алиасы плюс относительный заход. Ключи запросов сюда не входят. */
const API_CLIENT_MODULES = [
    { rule: 'apiClientOwnership', module: '@shared/api/client', example: '@shared/api/client' },
    { rule: 'apiClientOwnership', module: '@shared/api/domains', example: '@shared/api/domains/workoutsApi' },
    { rule: 'apiClientOwnership', moduleTemplate: '@features/*/api', example: '@features/profile/api/authApi' },
    { rule: 'apiClientOwnership', relativeDir: 'api', example: '../../api/workouts.api' },
]

/** Мутации и запросы ловятся по имени: их можно ввезти через любой баррель. */
const QUERY_IMPORT_NAMES = ['useMutation', 'useQueries', 'useQuery', 'useQueryClient']

/** Прямая сеть: `no-restricted-globals` не видит `window.fetch`, поэтому нужны оба правила. */
const NETWORK_GLOBAL_CALLS = ['fetch', 'XMLHttpRequest']

/** Движок очереди: доступ по этим именам, по модулю целиком или по глубокому пути. */
const QUEUE_ENGINE_MODULE = '@shared/offline/syncQueue'
const QUEUE_ENGINE_ENGINE_MODULE = `${QUEUE_ENGINE_MODULE}/engine`
const QUEUE_ENGINE_SYMBOLS = ['getSyncQueueEngine', 'SyncQueueEngine', 'resetSyncQueueEngineForTests']

// ─────────────────────────────── владельцы ───────────────────────────────

/**
 * Кто вправе брать движок очереди. Остальные читают очередь через `useSyncQueue`, а не
 * подписываются на движок сами. `**\/` в начале пути — «каталог на любом уровне».
 */
const QUEUE_ENGINE_OWNERS = [
    { path: 'shared/offline/', why: 'сам слой очереди: движок, персистентность, исполнитель операций' },
    { path: 'shared/hooks/useSyncQueue.ts', why: 'читающая поверхность — единственный вход для UI' },
    { path: 'app/providers/SyncQueueRunner.tsx', why: 'провайдер, гоняющий очередь по событиям браузера' },
]

/** Владельцы клиентов API: слои, которые и есть владельцы запросов. */
const API_CLIENT_OWNERS = ['app/', 'shared/api/', 'shared/offline/syncQueue/', '**/api/', '**/hooks/', '**/pages/']

const ANY_DEPTH = '**/'

/** Путь-владелец в том виде, в каком его сравнивает гвард: файл под ним или он сам. */
function isOwnerPath(file, ownerPath) {
    const relative = normalizePath(file)
    if (ownerPath.startsWith(ANY_DEPTH)) {
        const dir = ownerPath.slice(ANY_DEPTH.length).replace(/\/$/, '')
        return new RegExp(`(^|/)${escapeRegExp(dir)}/`).test(relative)
    }
    return ownerPath.endsWith('/') ? relative.startsWith(ownerPath) : relative === ownerPath
}

/** Тот же путь-владелец для ESLint: глоб, покрывающий ровно те же файлы. */
function ownerGlob(ownerPath) {
    if (ownerPath.startsWith(ANY_DEPTH)) return `src/${ANY_DEPTH}${ownerPath.slice(ANY_DEPTH.length).replace(/\/$/, '')}/**`
    return ownerPath.endsWith('/') ? `src/${ownerPath}**` : `src/${ownerPath}`
}

const API_CLIENT_OWNER_GLOBS = API_CLIENT_OWNERS.map(ownerGlob)
const QUEUE_ENGINE_OWNER_GLOBS = QUEUE_ENGINE_OWNERS.map((owner) => ownerGlob(owner.path))

function isApiClientOwner(file) {
    return API_CLIENT_OWNERS.some((ownerPath) => isOwnerPath(file, ownerPath))
}

function isQueueEngineOwner(file) {
    return QUEUE_ENGINE_OWNERS.some((owner) => isOwnerPath(file, owner.path))
}

// ─────────────────────── сопоставление спецификаторов ───────────────────────

/** Глобы ESLint для описания: тот же набор модулей, что и у регулярки ниже. */
function eslintGlobs(descriptor) {
    if (descriptor.module) return [`${descriptor.module}/**`]
    if (descriptor.moduleTemplate) return [descriptor.moduleTemplate, `${descriptor.moduleTemplate}/**`]
    if (descriptor.pathSegment) return [`**/${descriptor.pathSegment}`, `**/${descriptor.pathSegment}/**`]
    // Относительные заходы: три уровня покрывают реальные слои, глубже ловит только гвард —
    // глобом «на любой глубине» относительный путь не описать.
    return ['./', '../', '../../'].flatMap((prefix) => [
        `${prefix}${descriptor.relativeDir}`,
        `${prefix}${descriptor.relativeDir}/**`,
    ])
}

/** Регулярка для описания: то же, что глобы выше, но для AST-обхода гварда. */
function matchesSpecifier(descriptor, specifier) {
    if (descriptor.module) return new RegExp(`^${escapeRegExp(descriptor.module)}(/|$)`).test(specifier)
    if (descriptor.moduleTemplate) {
        const template = escapeRegExp(descriptor.moduleTemplate).replace(/\\\*/g, '[^/]+')
        return new RegExp(`^${template}(/|$)`).test(specifier)
    }
    if (descriptor.pathSegment) {
        return new RegExp(`(^|/)${escapeRegExp(descriptor.pathSegment)}(/|$)`).test(specifier)
    }
    return specifier.startsWith('.') && new RegExp(`(^|/)${escapeRegExp(descriptor.relativeDir)}(/|$)`).test(specifier)
}

/** Причины, по которым модуль запрещён компоненту: пусто — модуль ему не запрещён. */
function componentModuleViolations(specifier) {
    return COMPONENT_FORBIDDEN_MODULES.filter((descriptor) => matchesSpecifier(descriptor, specifier)).map(
        (descriptor) => RULES[descriptor.rule].reason,
    )
}

/** Клиент API ли это — по тем же правилам владения, что описывает конфиг. */
function isApiClientModule(specifier) {
    return API_CLIENT_MODULES.some((descriptor) => matchesSpecifier(descriptor, specifier))
}

/**
 * Причина, по которой файл получает доступ к движку очереди, или `null`, если доступа нет.
 * Импорт модуля целиком открывает и движок, даже если имя не названо.
 */
function queueEngineAccess({ modules, names, wholeModules }) {
    if (names.some((name) => QUEUE_ENGINE_SYMBOLS.includes(name))) return 'по имени из барреля'
    if (modules.includes(QUEUE_ENGINE_ENGINE_MODULE)) return 'глубокий путь к движку'
    if (wholeModules.some((module) => module === QUEUE_ENGINE_MODULE || module === QUEUE_ENGINE_ENGINE_MODULE)) {
        return 'импорт модуля целиком'
    }
    return null
}

// ─────────────────────────── правила для ESLint ───────────────────────────

/** `paths` + `patterns` из одного списка описаний: каждому описанию — своя подсказка. */
function eslintImports(descriptors) {
    const paths = []
    const patterns = []
    descriptors.forEach((descriptor) => {
        const message = RULES[descriptor.rule].hint
        if (descriptor.module) paths.push({ name: descriptor.module, message, allowTypeImports: true })
        patterns.push({ group: eslintGlobs(descriptor), message, allowTypeImports: true })
    })
    return { paths, patterns }
}

/** Правило 1: компоненту недоступен ни один сетевой модуль. */
const COMPONENT_IMPORTS = ['error', eslintImports(COMPONENT_FORBIDDEN_MODULES)]

/** Имена мутаций и запросов — на случай, если их реэкспортировали через другой модуль. */
const COMPONENT_IMPORT_NAME_RULE = [
    'error',
    ...QUERY_IMPORT_NAMES.map((name) => ({
        // Тип-онли у объявления и у самого спецификатора: `import type { useQuery }` связи не создаёт.
        selector: `ImportDeclaration[importKind!="type"] ImportSpecifier[imported.name="${name}"][importKind!="type"]`,
        message: RULES.importedQuery.hint,
    })),
]

const COMPONENT_GLOBAL_RULE = [
    'error',
    ...NETWORK_GLOBAL_CALLS.map((name) => ({ name, message: RULES.directNetwork.hint })),
]

const COMPONENT_GLOBAL_PROPERTY_RULE = [
    'error',
    ...NETWORK_GLOBAL_CALLS.map((property) => ({ object: 'window', property, message: RULES.directNetwork.hint })),
]

/** Правило 2: доступ к движку очереди — по имени из барреля или по глубокому пути. */
const QUEUE_ENGINE_PATHS = [
    {
        name: QUEUE_ENGINE_MODULE,
        importNames: QUEUE_ENGINE_SYMBOLS,
        message: RULES.queueEngineOwnership.hint,
        allowTypeImports: true,
    },
    { name: QUEUE_ENGINE_ENGINE_MODULE, message: RULES.queueEngineOwnership.hint, allowTypeImports: true },
]

/** Правило 2: клиенты API — только владельцам. */
const API_CLIENT_RULES = eslintImports(API_CLIENT_MODULES)

const API_CLIENT_IMPORTS = ['error', API_CLIENT_RULES]
const QUEUE_ENGINE_IMPORTS = ['error', { paths: QUEUE_ENGINE_PATHS }]
const API_CLIENT_AND_QUEUE_IMPORTS = [
    'error',
    { paths: [...API_CLIENT_RULES.paths, ...QUEUE_ENGINE_PATHS], patterns: API_CLIENT_RULES.patterns },
]

module.exports = {
    // пути: глобы для ESLint и предикаты для AST-обхода
    COMPONENT_GLOBS,
    TEST_GLOBS,
    SOURCE_GLOBS,
    isComponentPath,
    isTestPath,

    // владельцы
    API_CLIENT_OWNERS,
    QUEUE_ENGINE_OWNERS,
    API_CLIENT_OWNER_GLOBS,
    QUEUE_ENGINE_OWNER_GLOBS,
    isOwnerPath,
    isApiClientOwner,
    isQueueEngineOwner,

    // запрещённые модули и имена
    RULES,
    COMPONENT_FORBIDDEN_MODULES,
    API_CLIENT_MODULES,
    QUERY_IMPORT_NAMES,
    NETWORK_GLOBAL_CALLS,
    QUEUE_ENGINE_MODULE,
    QUEUE_ENGINE_ENGINE_MODULE,
    QUEUE_ENGINE_SYMBOLS,

    // предикаты гварда
    matchesSpecifier,
    componentModuleViolations,
    isApiClientModule,
    queueEngineAccess,

    // правила для ESLint
    COMPONENT_IMPORTS,
    COMPONENT_IMPORT_NAME_RULE,
    COMPONENT_GLOBAL_RULE,
    COMPONENT_GLOBAL_PROPERTY_RULE,
    API_CLIENT_IMPORTS,
    QUEUE_ENGINE_IMPORTS,
    API_CLIENT_AND_QUEUE_IMPORTS,
}
