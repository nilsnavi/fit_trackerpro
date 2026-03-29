import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PropsWithChildren, useState } from 'react'

/** Корневой клиент TanStack Query; ключи кэша — queryKeys (state/server). */
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

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
