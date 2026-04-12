import { useEffect, useState } from 'react'

export interface UseNetworkStatusResult {
    isOnline: boolean
    /** Становится true после первого перехода в офлайн (в т. ч. при старте офлайн) и остаётся true до размонтирования. */
    wasOffline: boolean
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
    const [wasOffline, setWasOffline] = useState(() => !readOnLine())

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true)
        }
        const onOffline = () => {
            setWasOffline(true)
            setIsOnline(false)
        }

        setIsOnline(readOnLine())
        if (!readOnLine()) {
            setWasOffline(true)
        }
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    return { isOnline, wasOffline }
}
