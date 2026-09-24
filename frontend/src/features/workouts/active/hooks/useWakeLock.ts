import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * SPEC-005 §49: keep the screen awake during an active workout.
 * Missing Wake Lock API must not produce an error (§49/AC-005-032).
 */

type WakeLockSentinelLike = {
    released: boolean
    release: () => Promise<void>
    addEventListener?: (type: string, listener: () => void) => void
}

type WakeLockApiLike = {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

function getWakeLockApi(): WakeLockApiLike | null {
    if (typeof navigator === 'undefined') return null
    const candidate = (navigator as Navigator & { wakeLock?: WakeLockApiLike }).wakeLock
    return candidate ?? null
}

interface UseWakeLockResult {
    /** True when a lock is currently held. */
    isActive: boolean
    /** True when the API exists on this device. */
    isSupported: boolean
    /** Acquire the wake lock (no-op when unsupported). */
    request: () => Promise<void>
    /** Release the wake lock (no-op when unsupported). */
    release: () => Promise<void>
}

export function useWakeLock(enabled: boolean): UseWakeLockResult {
    const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
    const [isActive, setIsActive] = useState(false)
    const [isSupported] = useState(() => getWakeLockApi() != null)
    const enabledRef = useRef(enabled)
    enabledRef.current = enabled

    const release = useCallback(async () => {
        const sentinel = sentinelRef.current
        sentinelRef.current = null
        setIsActive(false)
        if (!sentinel) return
        try {
            if (!sentinel.released) {
                await sentinel.release()
            }
        } catch {
            // Release failures are non-fatal (§49).
        }
    }, [])

    const request = useCallback(async () => {
        const api = getWakeLockApi()
        if (!api || !enabledRef.current) return
        try {
            if (sentinelRef.current && !sentinelRef.current.released) {
                setIsActive(true)
                return
            }
            const sentinel = await api.request('screen')
            sentinelRef.current = sentinel
            setIsActive(true)
            sentinel.addEventListener?.('release', () => {
                setIsActive(false)
            })
        } catch {
            // §49: unsupported/blocked API must not break the workout.
            setIsActive(false)
        }
    }, [])

    useEffect(() => {
        if (enabled) {
            void request()
        } else {
            void release()
        }
    }, [enabled, request, release])

    // Re-acquire after the tab becomes visible again (browsers auto-release).
    useEffect(() => {
        if (!enabled) return undefined
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                void request()
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [enabled, request])

    useEffect(() => {
        return () => {
            void release()
        }
    }, [release])

    return { isActive, isSupported, request, release }
}
