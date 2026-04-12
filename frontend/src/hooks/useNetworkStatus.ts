import { useEffect, useState } from 'react'

export interface UseNetworkStatusResult {
    isOnline: boolean
}

function readOnLine(): boolean {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
}

/**
 * Подписка на `window` online/offline и начальное значение `navigator.onLine`.
 */
export function useNetworkStatus(): UseNetworkStatusResult {
    const [isOnline, setIsOnline] = useState(readOnLine)

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true)
        }
        const onOffline = () => {
            setIsOnline(false)
        }

        setIsOnline(readOnLine())
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    return { isOnline }
}
