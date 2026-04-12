import { useCallback, useEffect, useRef, useState } from 'react'

export interface NetworkStatus {
    isOnline: boolean
    /** Был офлайн в этой сессии; остаётся true после возврата online до внутреннего сброса (таймер). */
    wasOffline: boolean
}

const RECONNECT_BANNER_CLEAR_MS = 12_000

function readOnLine(): boolean {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
}

/**
 * Состояние сети для Mini App: navigator.onLine + события online/offline.
 * `wasOffline` поднимается при переходе offline→online (для баннера «соединение восстановлено»).
 */
export function useNetworkStatus(): NetworkStatus {
    const [isOnline, setIsOnline] = useState(readOnLine)
    const [wasOffline, setWasOffline] = useState(false)
    const hadOfflineRef = useRef(false)
    const clearTimerRef = useRef<number | null>(null)

    const clearReconnectTimer = useCallback(() => {
        if (clearTimerRef.current != null) {
            window.clearTimeout(clearTimerRef.current)
            clearTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true)
            if (hadOfflineRef.current) {
                setWasOffline(true)
                clearReconnectTimer()
                clearTimerRef.current = window.setTimeout(() => {
                    clearTimerRef.current = null
                    setWasOffline(false)
                }, RECONNECT_BANNER_CLEAR_MS)
            }
        }
        const onOffline = () => {
            hadOfflineRef.current = true
            setIsOnline(false)
            clearReconnectTimer()
            setWasOffline(false)
        }

        setIsOnline(readOnLine())
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
            clearReconnectTimer()
        }
    }, [clearReconnectTimer])

    return { isOnline, wasOffline }
}
