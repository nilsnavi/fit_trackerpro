/**
 * useRestTimer Hook
 * 
 * Хук для управления таймером отдыха между подходами.
 * Чистая бизнес-логика без UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseRestTimerParams {
    initialSeconds?: number
    onComplete?: () => void
}

export function useRestTimer({ initialSeconds = 90, onComplete }: UseRestTimerParams = {}) {
    const [seconds, setSeconds] = useState(initialSeconds)
    const [isActive, setIsActive] = useState(false)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const onCompleteRef = useRef(onComplete)

    // Обновляем callback при изменении
    useEffect(() => {
        onCompleteRef.current = onComplete
    }, [onComplete])

    // Запуск таймера
    const start = useCallback((duration?: number) => {
        if (duration !== undefined) {
            setSeconds(duration)
        }
        setIsActive(true)
    }, [])

    // Остановка таймера
    const stop = useCallback(() => {
        setIsActive(false)
    }, [])

    // Сброс таймера
    const reset = useCallback((duration?: number) => {
        setIsActive(false)
        setSeconds(duration ?? initialSeconds)
    }, [initialSeconds])

    // Пропуск таймера
    const skip = useCallback(() => {
        setIsActive(false)
        setSeconds(0)
        onCompleteRef.current?.()
    }, [])

    // Тик таймера каждую секунду
    useEffect(() => {
        if (isActive && seconds > 0) {
            intervalRef.current = setInterval(() => {
                setSeconds((prev) => {
                    if (prev <= 1) {
                        // Таймер завершен
                        setIsActive(false)
                        onCompleteRef.current?.()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isActive, seconds])

    // Форматирование времени MM:SS
    const formattedTime = useCallback(() => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }, [seconds])

    // Прогресс в процентах (для прогресс-бара)
    const progress = useCallback(() => {
        return initialSeconds > 0 ? ((initialSeconds - seconds) / initialSeconds) * 100 : 0
    }, [seconds, initialSeconds])

    return {
        seconds,
        isActive,
        formattedTime: formattedTime(),
        progress: progress(),
        start,
        stop,
        reset,
        skip,
    }
}
