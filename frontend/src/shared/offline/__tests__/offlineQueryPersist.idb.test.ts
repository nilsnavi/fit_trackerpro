import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query'
import { createOfflineQueryPersister, shouldDehydrateOfflineQuery } from '../offlineQueryPersist'
import { createIndexedDbKV } from '../storage/indexedDbKV'

function makeClientState(qc: QueryClient) {
  return {
    buster: 'test',
    timestamp: Date.now(),
    clientState: dehydrate(qc, {
      shouldDehydrateQuery: shouldDehydrateOfflineQuery,
    }),
  }
}

describe('offline query persistence (IndexedDB)', () => {
  test('dehydrate/hydrate keeps only allowed success queries', async () => {
    expect(typeof (globalThis as any).indexedDB).not.toBe('undefined')

    // Sanity check: IndexedDB KV works in the test environment.
    const kv = createIndexedDbKV()
    await kv.set('queryCache', 'kv_sanity', 'ok')
    await expect(kv.get('queryCache', 'kv_sanity')).resolves.toBe('ok')

    const qc1 = new QueryClient()

    qc1.setQueryData(['exercises', 'list'], { ok: 1 })
    qc1.setQueryData(['reference', 'muscles'], [{ id: 1 }])
    qc1.setQueryData(['workouts', 'history', { page: 1 }], { items: [1, 2] })
    qc1.setQueryData(['workouts', 'history', 'item', 123], { id: 123 })
    qc1.setQueryData(['workouts', 'templates', 'list'], [{ id: 1 }])
    qc1.setQueryData(['workouts', 'templates', 'detail', 99], { id: 99 })

    // Must NOT be persisted (sensitive / unrelated)
    qc1.setQueryData(['profile', 'me'], { id: 'secret' })
    qc1.setQueryData(['auth', 'token'], 'nope')

    const persister = createOfflineQueryPersister()
    await persister.removeClient()
    await persister.persistClient(makeClientState(qc1) as unknown as any)

    const restored = await persister.restoreClient()
    expect(restored).toBeTruthy()

    const qc2 = new QueryClient()
    hydrate(qc2, (restored as any).clientState)

    expect(qc2.getQueryData(['exercises', 'list'])).toEqual({ ok: 1 })
    expect(qc2.getQueryData(['reference', 'muscles'])).toEqual([{ id: 1 }])
    expect(qc2.getQueryData(['workouts', 'history', { page: 1 }])).toEqual({ items: [1, 2] })
    expect(qc2.getQueryData(['workouts', 'history', 'item', 123])).toEqual({ id: 123 })
    expect(qc2.getQueryData(['workouts', 'templates', 'list'])).toEqual([{ id: 1 }])
    expect(qc2.getQueryData(['workouts', 'templates', 'detail', 99])).toEqual({ id: 99 })

    expect(qc2.getQueryData(['profile', 'me'])).toBeUndefined()
    expect(qc2.getQueryData(['auth', 'token'])).toBeUndefined()
  })

  test('graceful fallback when IndexedDB is unavailable', async () => {
    const original = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = undefined

    const persister = createOfflineQueryPersister()
    await expect(persister.persistClient({} as any)).resolves.toBeUndefined()
    await expect(persister.restoreClient()).resolves.toBeUndefined()
    await expect(persister.removeClient()).resolves.toBeUndefined()

    ;(globalThis as any).indexedDB = original
  })

  test('version bump / cache invalidation via buster', async () => {
    const { persistQueryClientRestore } = await import('@tanstack/query-persist-client-core')

    const qc1 = new QueryClient()
    qc1.setQueryData(['exercises', 'list'], { ok: 1 })
    const persister = createOfflineQueryPersister()
    await persister.removeClient()
    await persister.persistClient({
      buster: 'old',
      timestamp: Date.now(),
      clientState: dehydrate(qc1, { shouldDehydrateQuery: shouldDehydrateOfflineQuery }),
    } as any)

    const qc2 = new QueryClient()
    await persistQueryClientRestore({
      queryClient: qc2,
      persister,
      buster: 'new',
      maxAge: 1000 * 60 * 60,
    } as any)

    expect(qc2.getQueryData(['exercises', 'list'])).toBeUndefined()
  })
})

