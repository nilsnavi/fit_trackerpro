import { useEffect, useMemo } from 'react'

interface UseRestTimerParams {
    isRunning: boolean
    tick: () => void
}

function formatRestTimeValue(seconds: number): string {
    const safeSeconds = Math.max(0, seconds)
    const mins = Math.floor(safeSeconds / 60)
    const secs = safeSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function useRestTimer({ isRunning, tick }: UseRestTimerParams) {
    useEffect(() => {
        if (!isRunning) return
        const interval = window.setInterval(() => {
            tick()
        }, 1000)

        return () => {
            window.clearInterval(interval)
        }
    }, [isRunning, tick])

    const formatRestTime = useMemo(() => formatRestTimeValue, [])

    return {
        formatRestTime,
    }
}
