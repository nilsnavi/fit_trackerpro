/**
 * useTimer Hook
 * High-precision timer with requestAnimationFrame for workout rest periods
 */
import { useState, useCallback, useRef, useEffect } from 'react'

export type TimerState = 'idle' | 'running' | 'paused' | 'completed'

export interface UseTimerOptions {
    /** Initial duration in seconds */
    initialDuration?: number
    /** Callback when timer completes */
    onComplete?: () => void
    /** Callback on each tick with remaining time */
    onTick?: (remaining: number) => void
    /** Callback when 10 seconds warning triggers */
    onWarning?: () => void
    /** Auto-start on mount */
    autoStart?: boolean
    /** Enable sound notifications */
    enableSound?: boolean
    /** Enable haptic feedback */
    enableHaptic?: boolean
}

export interface UseTimerReturn {
    /** Current time left in seconds */
    timeLeft: number
    /** Total duration in seconds */
    duration: number
    /** Current timer state */
    state: TimerState
    /** Progress percentage (0-100) */
    progress: number
    /** Whether timer is in warning phase (< 10 seconds) */
    isWarning: boolean
    /** Start the timer */
    start: () => void
    /** Pause the timer */
    pause: () => void
    /** Reset timer to initial or specified duration */
    reset: (newDuration?: number) => void
    /** Set new duration without starting */
    setDuration: (seconds: number) => void
    /** Skip/complete timer immediately */
    skip: () => void
    /** Add time to current timer */
    addTime: (seconds: number) => void
    /** Formatted time string (MM:SS) */
    formattedTime: string
}

/**
 * Hook for high-precision workout timer
 * Uses requestAnimationFrame for accuracy and supports background operation
 */
export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
    const {
        initialDuration = 60,
        onComplete,
        onTick,
        onWarning,
        autoStart = false,
    } = options

    const [duration, setDurationState] = useState(initialDuration)
    const [timeLeft, setTimeLeft] = useState(initialDuration)
    const [state, setState] = useState<TimerState>(autoStart ? 'running' : 'idle')
    const [isWarning, setIsWarning] = useState(false)

    // Refs for precise timing
    const animationFrameRef = useRef<number | null>(null)
    const lastTimeRef = useRef<number>(0)
    const accumulatedTimeRef = useRef<number>(0)
    const hasCompletedRef = useRef(false)
    const hasWarnedRef = useRef(false)
    const stateRef = useRef<TimerState>(state)

    // Keep state ref in sync
    useEffect(() => {
        stateRef.current = state
    }, [state])

    // Calculate progress percentage
    const progress = ((duration - timeLeft) / duration) * 100

    // Format time as MM:SS
    const formattedTime = useCallback((seconds: number = timeLeft): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }, [timeLeft])

    // Update warning state
    useEffect(() => {
        const warning = timeLeft <= 10 && timeLeft > 0 && state === 'running'
        setIsWarning(warning)

        if (warning && !hasWarnedRef.current && onWarning) {
            hasWarnedRef.current = true
            onWarning()
        }
    }, [timeLeft, state, onWarning])

    // Timer tick function using requestAnimationFrame
    const tick = useCallback((timestamp: number) => {
        if (stateRef.current !== 'running') return

        if (!lastTimeRef.current) {
            lastTimeRef.current = timestamp
        }

        const deltaTime = timestamp - lastTimeRef.current
        lastTimeRef.current = timestamp

        // Accumulate time
        accumulatedTimeRef.current += deltaTime

        // Update every 100ms for smooth UI, but track seconds accurately
        if (accumulatedTimeRef.current >= 100) {
            const secondsToSubtract = accumulatedTimeRef.current / 1000
            accumulatedTimeRef.current = accumulatedTimeRef.current % 100

            setTimeLeft((prev: number) => {
                const newTime = Math.max(0, prev - secondsToSubtract)
                const roundedTime = Math.ceil(newTime)

                // Call onTick with rounded time
                if (onTick && roundedTime !== Math.ceil(prev)) {
                    onTick(roundedTime)
                }

                // Check for completion
                if (newTime <= 0 && !hasCompletedRef.current) {
                    hasCompletedRef.current = true
                    setState('completed')
                    onComplete?.()
                    return 0
                }

                return newTime
            })
        }

        // Continue animation loop
        if (stateRef.current === 'running') {
            animationFrameRef.current = requestAnimationFrame(tick)
        }
    }, [onComplete, onTick])

    // Start timer
    const start = useCallback(() => {
        if (state === 'completed') {
            reset()
        }

        setState('running')
        lastTimeRef.current = 0
        accumulatedTimeRef.current = 0
        animationFrameRef.current = requestAnimationFrame(tick)
    }, [state, tick])

    // Pause timer
    const pause = useCallback(() => {
        setState('paused')
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }
    }, [])

    // Reset timer
    const reset = useCallback((newDuration?: number) => {
        const targetDuration = newDuration ?? duration
        if (newDuration !== undefined) {
            setDurationState(targetDuration)
        }
        setTimeLeft(targetDuration)
        setState('idle')
        setIsWarning(false)
        hasCompletedRef.current = false
        hasWarnedRef.current = false
        lastTimeRef.current = 0
        accumulatedTimeRef.current = 0

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }
    }, [duration])

    // Set duration without starting
    const setDuration = useCallback((seconds: number) => {
        setDurationState(seconds)
        setTimeLeft(seconds)
        setIsWarning(false)
        hasWarnedRef.current = false
    }, [])

    // Skip timer (complete immediately)
    const skip = useCallback(() => {
        setTimeLeft(0)
        setState('completed')
        hasCompletedRef.current = true

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }

        onComplete?.()
    }, [onComplete])

    // Add time to current timer
    const addTime = useCallback((seconds: number) => {
        setTimeLeft((prev: number) => {
            const newTime = prev + seconds
            // Reset warning if we go above 10 seconds
            if (newTime > 10) {
                hasWarnedRef.current = false
                setIsWarning(false)
            }
            return newTime
        })
    }, [])

    // Auto-start effect
    useEffect(() => {
        if (autoStart && state === 'idle') {
            start()
        }
    }, [autoStart, state, start])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [])

    // Handle visibility change for background operation
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && stateRef.current === 'running') {
                // Store timestamp when going to background
                lastTimeRef.current = performance.now()
            } else if (!document.hidden && stateRef.current === 'running') {
                // Calculate elapsed time when coming back
                const elapsed = (performance.now() - lastTimeRef.current) / 1000
                if (elapsed > 1) {
                    setTimeLeft((prev: number) => {
                        const newTime = Math.max(0, prev - elapsed)
                        if (newTime <= 0 && !hasCompletedRef.current) {
                            hasCompletedRef.current = true
                            setState('completed')
                            onComplete?.()
                            return 0
                        }
                        return newTime
                    })
                }
                lastTimeRef.current = 0
                accumulatedTimeRef.current = 0
                animationFrameRef.current = requestAnimationFrame(tick)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [onComplete, tick])

    return {
        timeLeft: Math.ceil(timeLeft),
        duration,
        state,
        progress,
        isWarning,
        start,
        pause,
        reset,
        setDuration,
        skip,
        addTime,
        formattedTime: formattedTime(),
    }
}

export default useTimer
