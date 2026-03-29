import { useEffect, useState } from 'react'

/**
 * Состояние сети браузера (события online/offline).
 */
export function useNetworkOnline(): boolean {
    const [online, setOnline] = useState(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    )

    useEffect(() => {
        const onOnline = () => setOnline(true)
        const onOffline = () => setOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    return online
}
