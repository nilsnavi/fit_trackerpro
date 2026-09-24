import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface InfiniteScrollTriggerProps {
    hasNextPage: boolean
    isFetchingNextPage: boolean
    fetchNextPage: () => void
}

export function InfiniteScrollTrigger({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
}: InfiniteScrollTriggerProps) {
    const observerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const element = observerRef.current
        if (!element || !hasNextPage) return

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries
                if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage()
                }
            },
            {
                rootMargin: '200px',
                threshold: 0,
            }
        )

        observer.observe(element)

        return () => {
            observer.disconnect()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    if (!hasNextPage) return null

    return (
        <div ref={observerRef} className="flex items-center justify-center py-6">
            {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-sm text-telegram-hint">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Загрузка...</span>
                </div>
            ) : (
                <div className="h-1 w-32 rounded-full bg-telegram-bg" />
            )}
        </div>
    )
}
