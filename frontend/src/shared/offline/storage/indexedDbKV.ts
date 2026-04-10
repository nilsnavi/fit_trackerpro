export type IndexedDbKVStoreName = 'queryCache' | 'activeWorkoutDraft' | 'syncQueue'

type OpenDbOptions = {
  dbName: string
  version: number
  stores: readonly IndexedDbKVStoreName[]
}

let openPromise: Promise<IDBDatabase> | null = null

function isIndexedDbLikelyAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function openDb(options: OpenDbOptions): Promise<IDBDatabase> {
  if (openPromise) return openPromise

  openPromise = new Promise((resolve, reject) => {
    if (!isIndexedDbLikelyAvailable()) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(options.dbName, options.version)
    } catch (e) {
      reject(e)
      return
    }

    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of options.stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => {
      // Another tab holds the old version open. Don't hard-fail the app;
      // callers will handle the rejection gracefully.
      reject(new Error('IndexedDB open blocked'))
    }
  })

  return openPromise
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export type IndexedDbKV = {
  get: (store: IndexedDbKVStoreName, key: string) => Promise<string | null>
  set: (store: IndexedDbKVStoreName, key: string, value: string) => Promise<void>
  del: (store: IndexedDbKVStoreName, key: string) => Promise<void>
}

export function createIndexedDbKV(options: {
  dbName?: string
  version?: number
} = {}): IndexedDbKV {
  const dbName = options.dbName ?? 'fittracker_offline'
  const version = options.version ?? 1
  const stores: readonly IndexedDbKVStoreName[] = [
    'queryCache',
    'activeWorkoutDraft',
    'syncQueue',
  ]

  return {
    async get(store, key) {
      const db = await openDb({ dbName, version, stores })
      const tx = db.transaction(store, 'readonly')
      const os = tx.objectStore(store)
      const res = await requestToPromise(os.get(key))
      return typeof res === 'string' ? res : res == null ? null : String(res)
    },
    async set(store, key, value) {
      const db = await openDb({ dbName, version, stores })
      const tx = db.transaction(store, 'readwrite')
      const os = tx.objectStore(store)
      await requestToPromise(os.put(value, key))
    },
    async del(store, key) {
      const db = await openDb({ dbName, version, stores })
      const tx = db.transaction(store, 'readwrite')
      const os = tx.objectStore(store)
      await requestToPromise(os.delete(key))
    },
  }
}

