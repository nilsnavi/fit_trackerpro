/* eslint-disable @typescript-eslint/no-var-requires -- у ESLint 8 нет своих типов, конфиг берём тем же модулем, что и CLI */
import * as path from 'node:path'

/**
 * Граница сетевого слоя в ESLint (`frontend/.eslintrc.cjs`) проверяется так же, как сам гвард
 * `networkBoundary.test.ts`, но через настоящий конфиг: правило падает при написании импорта, а
 * этот тест — если правило ослабеют, выключат или оно перестанет применяться к файлу.
 *
 * Конфиг читается тем же модулем, что и `npm run lint`: синтетические исходники линтуются в тех
 * же областях (`files`/`excludedFiles`), поэтому проверка ловит и ослабление правил. Запрещённые
 * модули берутся из общей политики — новый пункт списка получает проверку сразу же.
 */
const { ESLint } = require('eslint')
// Политика и конфиг читаются теми же модулями, что и `npm run lint`: список запрещённого живёт
// в `architecture/networkBoundary.policy.cjs`, поэтому тест проверяет его, а не свою его копию.
const policy = require('../../../architecture/networkBoundary.policy.cjs')

const FRONTEND_ROOT = path.resolve(__dirname, '..', '..', '..')
const eslint = new ESLint({ cwd: FRONTEND_ROOT, ignore: false })

const IMPORT_RULE = '@typescript-eslint/no-restricted-imports'
const NAMES_RULE = 'no-restricted-syntax'
const GLOBALS_RULE = 'no-restricted-globals'
const PROPERTIES_RULE = 'no-restricted-properties'

interface Report {
    ruleId: string | null
    message: string
}

async function lint(relativePath: string, source: string): Promise<Report[]> {
    const [result] = await eslint.lintText(source, { filePath: path.join(FRONTEND_ROOT, relativePath) })
    return result.messages
}

/** Сообщения конкретного правила: остальные (unused-vars и т.п.) к границе не относятся. */
async function violations(relativePath: string, source: string, ruleId: string): Promise<string[]> {
    return (await lint(relativePath, source))
        .filter(({ ruleId: id }) => id === ruleId)
        .map(({ message }) => message)
}

const COMPONENT = 'src/widgets/components/Widget.tsx'

describe('ESLint: компонент не владеет сетью', () => {
    jest.setTimeout(30_000)

    it('ловит каждый запрещённый модуль из общей политики, ввезённый в компонент', async () => {
        const descriptors = policy.COMPONENT_FORBIDDEN_MODULES
        const source = descriptors
            .map((descriptor: { example: string }, index: number) => `import { value${index} } from '${descriptor.example}'`)
            .join('\n')

        const messages = await violations(COMPONENT, source, IMPORT_RULE)

        // Ровно по одному сообщению на описание: список запрещённого берётся из общей политики.
        expect(messages).toHaveLength(descriptors.length)
        descriptors.forEach((descriptor: { example: string }) => {
            expect(messages).toEqual(expect.arrayContaining([expect.stringContaining(`'${descriptor.example}'`)]))
        })
    })

    it('разрешает типы api-слоя и модули без сети', async () => {
        const source = [
            "import type { SyncQueueItem } from '@shared/offline/syncQueue'",
            "import { type WorkoutSetResponse } from '@shared/api/domains/workoutsApi'",
            "import type { ApiMuscleLoadTableEntry } from '@features/analytics/api/analyticsDomain'",
            "import { cn } from '@shared/lib/cn'",
            "import { useSyncQueue } from '@shared/hooks/useSyncQueue'",
        ].join('\n')

        expect(await violations(COMPONENT, source, IMPORT_RULE)).toEqual([])
    })

    it('ловит запрос или мутацию, ввезённые через баррель', async () => {
        const mixed = await violations(
            COMPONENT,
            "import { type UseMutationResult, useMutation } from '@barrel/whatever'",
            NAMES_RULE,
        )
        expect(mixed).toHaveLength(1)

        // Чисто тип-онли импорт стирается при сборке и связи с сетью не создаёт.
        expect(await violations(
            COMPONENT,
            "import type { useMutation } from '@barrel/whatever'",
            NAMES_RULE,
        )).toEqual([])
    })

    it('ловит прямой вызов сети и не путает его с локальным хелпером', async () => {
        const source = [
            "const load = () => fetch('/api/v1/users')",
            'const xml = new XMLHttpRequest()',
            "const retry = () => window.fetch('/api/v1/users')",
        ].join('\n')

        expect(await violations(COMPONENT, source, GLOBALS_RULE)).toHaveLength(2)
        expect(await violations(COMPONENT, source, PROPERTIES_RULE)).toHaveLength(1)

        const helpers = "const reload = () => refetch()\nconst next = () => fetchNextPage()"
        expect(await violations(COMPONENT, helpers, GLOBALS_RULE)).toEqual([])
        expect(await violations(COMPONENT, helpers, PROPERTIES_RULE)).toEqual([])
    })

    it('не трогает ленивый чанк соседнего компонента', async () => {
        expect(await violations(
            COMPONENT,
            "const Card = lazy(() => import('./ProgressionRecommendationCard'))",
            IMPORT_RULE,
        )).toEqual([])
    })
})

describe('ESLint: сетевой слой принадлежит явным владельцам', () => {
    jest.setTimeout(30_000)

    it('посторонний файл не берёт ни клиенты API, ни движок очереди', async () => {
        const outsider = 'src/state/server.ts'

        // Клиенты — из общей политики: добавил правило, получил проверку.
        for (const descriptor of policy.API_CLIENT_MODULES) {
            expect(await violations(outsider, `import { value } from '${descriptor.example}'`, IMPORT_RULE)).toHaveLength(1)
        }
        for (const symbol of policy.QUEUE_ENGINE_SYMBOLS) {
            expect(await violations(outsider, `import { ${symbol} } from '${policy.QUEUE_ENGINE_MODULE}'`, IMPORT_RULE)).toHaveLength(1)
        }
        expect(await violations(outsider, `import { engine } from '${policy.QUEUE_ENGINE_ENGINE_MODULE}'`, IMPORT_RULE)).toHaveLength(1)
        // Импорт модуля целиком обходит проверку имён — и всё равно ловится.
        expect(await violations(outsider, `import * as syncQueue from '${policy.QUEUE_ENGINE_MODULE}'`, IMPORT_RULE)).toHaveLength(1)

        // Ключи запросов — не клиент; помощник очереди не даёт доступа к движку.
        expect(await violations(outsider, "import { queryKeys } from '@shared/api/queryKeys'", IMPORT_RULE)).toEqual([])
        expect(await violations(outsider, "import { isRecoverableSyncError } from '@shared/offline/syncQueue'", IMPORT_RULE)).toEqual([])
    })

    it('области конфига целиком собраны из общей политики', () => {
        const config = require('../../../.eslintrc.cjs')
        const known = new Set([
            ...policy.COMPONENT_GLOBS,
            ...policy.TEST_GLOBS,
            ...policy.SOURCE_GLOBS,
            ...policy.API_CLIENT_OWNER_GLOBS,
            ...policy.QUEUE_ENGINE_OWNER_GLOBS,
        ])

        const used = config.overrides.flatMap((override: { files?: string[]; excludedFiles?: string[] }) => [
            ...(override.files ?? []),
            ...(override.excludedFiles ?? []),
        ])

        // Ни один глоб не написан в конфиге заново: он обязан прийти из политики.
        expect(used.length).toBeGreaterThan(10)
        used.forEach((glob: string) => expect(known.has(glob)).toBe(true))
    })

    it('владелец клиентов API не берёт движок очереди, но берёт клиенты', async () => {
        const hook = 'src/features/workouts/hooks/useActiveWorkout.ts'

        expect(await violations(hook, "import { workoutsApi } from '../api/workouts.api'", IMPORT_RULE)).toEqual([])
        expect(await violations(hook, "import { api } from '@shared/api/client'", IMPORT_RULE)).toEqual([])
        expect(await violations(hook, "import { getSyncQueueEngine } from '@shared/offline/syncQueue'", IMPORT_RULE)).toHaveLength(1)
    })

    it('владелец очереди не берёт клиенты API, но берёт движок', async () => {
        expect(await violations(
            'src/shared/hooks/useSyncQueue.ts',
            "import { getSyncQueueEngine } from '@shared/offline/syncQueue'",
            IMPORT_RULE,
        )).toEqual([])
        expect(await violations(
            'src/app/providers/SyncQueueRunner.tsx',
            "import { SyncQueueEngine } from '@shared/offline/syncQueue/engine'",
            IMPORT_RULE,
        )).toEqual([])
        // Слой очереди целиком принадлежит и клиентам API.
        expect(await violations(
            'src/shared/offline/syncQueue/executor.ts',
            "import { api } from '@shared/api/client'",
            IMPORT_RULE,
        )).toEqual([])
        // А остальной офлайн-слой — нет.
        expect(await violations(
            'src/shared/offline/workoutOfflineEnqueue.ts',
            "import { api } from '@shared/api/client'",
            IMPORT_RULE,
        )).toHaveLength(1)
    })

    it('компонент в app/ остаётся компонентом', async () => {
        expect(await violations(
            'src/app/components/Telemetry.tsx',
            "import { api } from '@shared/api/client'",
            IMPORT_RULE,
        )).toHaveLength(1)
    })

    it('тесты вне границы', async () => {
        const source = [
            "import { api } from '@shared/api/client'",
            "import { getSyncQueueEngine } from '@shared/offline/syncQueue'",
            "import { useQuery } from '@tanstack/react-query'",
        ].join('\n')

        expect(await violations('src/features/analytics/components/__tests__/Card.test.tsx', source, IMPORT_RULE)).toEqual([])
        expect(await violations('src/features/analytics/hooks/useFoo.test.ts', source, IMPORT_RULE)).toEqual([])
    })
})
