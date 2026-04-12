import { useMemo } from 'react'

/** Прошедшее время отдыха по таймеру (длительность минус остаток). */
export function getRestElapsedSeconds(durationSeconds: number, remainingSeconds: number): number {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return 0
    }
    return Math.max(0, Math.round(durationSeconds - Math.max(0, remainingSeconds)))
}

export function formatDurationParts(totalSeconds: number): { minutes: number; seconds: number } {
    const s = Math.max(0, Math.floor(totalSeconds))
    return { minutes: Math.floor(s / 60), seconds: s % 60 }
}

export function useRestElapsedSeconds(durationSeconds: number, remainingSeconds: number): number {
    return useMemo(
        () => getRestElapsedSeconds(durationSeconds, remainingSeconds),
        [durationSeconds, remainingSeconds],
    )
}
