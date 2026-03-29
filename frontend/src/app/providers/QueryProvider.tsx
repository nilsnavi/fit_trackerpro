import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { PropsWithChildren, useState } from 'react'
import {
    createOfflineQueryPersister,
    OFFLINE_QUERY_CACHE_MAX_AGE_MS,
    shouldDehydrateOfflineQuery,
} from '@shared/offline/offlineQueryPersist'

/** Корневой клиент TanStack Query; офлайн — last-known для каталога (см. offlineQueryPersist). */
export function QueryProvider({ children }: PropsWithChildren) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,
                        retry: 1,
                    },
                },
            }),
    )

    const persister = createOfflineQueryPersister()

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: OFFLINE_QUERY_CACHE_MAX_AGE_MS,
                buster: import.meta.env.VITE_APP_BUILD_ID ?? 'v1',
                dehydrateOptions: {
                    shouldDehydrateQuery: shouldDehydrateOfflineQuery,
                },
            }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}
