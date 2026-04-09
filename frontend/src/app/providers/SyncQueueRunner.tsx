import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { getSyncQueueEngine } from '@shared/offline/syncQueue'

const FLUSH_INTERVAL_MS = 15_000

/**
 * Фоновая отправка офлайн-очереди: при появлении сети, по таймеру и при возврате во вкладку.
 */
export function SyncQueueRunner() {
    const queryClient = useQueryClient()
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    useEffect(() => {
        const engine = getSyncQueueEngine()

        const runFlush = async () => {
            const n = await engine.flush()
            if (!mounted.current) return
            if (n > 0) {
                void queryClient.invalidateQueries({ queryKey: ['workouts'] })
                void queryClient.invalidateQueries({ queryKey: ['analytics'] })
            }
        }

        void runFlush()

        const onOnline = () => {
            void runFlush()
        }
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void runFlush()
            }
        }

        window.addEventListener('online', onOnline)
        document.addEventListener('visibilitychange', onVisible)
        const interval = window.setInterval(() => {
            void runFlush()
        }, FLUSH_INTERVAL_MS)

        return () => {
            window.removeEventListener('online', onOnline)
            document.removeEventListener('visibilitychange', onVisible)
            window.clearInterval(interval)
        }
    }, [queryClient])

    return null
}
