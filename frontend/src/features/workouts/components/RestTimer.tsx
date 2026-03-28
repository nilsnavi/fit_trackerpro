/**
 * RestTimer Component
 * High-precision rest timer for workout sessions with circular progress,
 * sound notifications, haptic feedback, and background mode support
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@shared/lib/cn'
import { useTimer } from '@shared/hooks/useTimer'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

export interface RestTimerProps {
    /** Initial duration in seconds */
    initialDuration?: number
    /** Callback when timer completes */
    onComplete?: () => void
    /** Callback when timer is skipped */
    onSkip?: () => void
    /** Callback when duration changes */
    onDurationChange?: (duration: number) => void
    /** Auto-start on mount */
    autoStart?: boolean
    /** Show quick select chips */
    showQuickSelect?: boolean
    /** Enable sound notifications */
    enableSound?: boolean
    /** Enable haptic feedback */
    enableHaptic?: boolean
    /** CSS class */
    className?: string
}

// Quick select presets
const QUICK_PRESETS = [30, 60, 90, 120, 180]

/**
 * Sound generator using Web Audio API
 * Generates beep sounds without external files
 */
class SoundGenerator {
    private audioContext: AudioContext | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass()
            }
        }
    }

    /**
     * Play a beep sound
     * @param frequency - Frequency in Hz
     * @param duration - Duration in seconds
     * @param type - Oscillator type
     */
    playBeep(frequency: number = 800, duration: number = 0.2, type: OscillatorType = 'sine'): void {
        if (!this.audioContext) return

        // Resume context if suspended (browser policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
        }

        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = type

        // Envelope for smoother sound
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration)
    }

    /**
     * Play warning beep (higher pitch, shorter)
     */
    playWarning(): void {
        this.playBeep(1000, 0.15, 'sine')
    }

    /**
     * Play completion sound (double beep)
     */
    playComplete(): void {
        if (!this.audioContext) return

        this.playBeep(1200, 0.3, 'sine')

        setTimeout(() => {
            this.playBeep(1500, 0.5, 'sine')
        }, 200)
    }

    /**
     * Play tick sound (very short, subtle)
     */
    playTick(): void {
        this.playBeep(600, 0.05, 'triangle')
    }
}

/**
 * RestTimer - Workout rest period timer with full features
 */
export const RestTimer: React.FC<RestTimerProps> = ({
    initialDuration = 60,
    onComplete,
    onSkip,
    onDurationChange,
    autoStart = false,
    showQuickSelect = true,
    enableSound = true,
    enableHaptic = true,
    className,
}) => {
    const { hapticFeedback, isTelegram } = useTelegramWebApp()
    const soundGenerator = useRef(new SoundGenerator()).current
    const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
    const lastTickSecond = useRef<number>(0)

    // Initialize timer hook
    const {
        timeLeft,
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
        formattedTime,
    } = useTimer({
        initialDuration,
        autoStart,
        onComplete: useCallback(() => {
            // Play completion sound
            if (enableSound) {
                soundGenerator.playComplete()
            }

            // Haptic feedback - 3 vibrations
            if (enableHaptic && isTelegram) {
                hapticFeedback({ type: 'notification', notificationType: 'success' })
                setTimeout(() => {
                    hapticFeedback({ type: 'impact', style: 'medium' })
                }, 100)
                setTimeout(() => {
                    hapticFeedback({ type: 'impact', style: 'medium' })
                }, 200)
            }

            onComplete?.()
        }, [enableSound, enableHaptic, isTelegram, hapticFeedback, onComplete, soundGenerator]),

        onTick: useCallback((remaining: number) => {
            // Play tick every 10 seconds (at 50, 40, 30, 20, 10)
            if (enableSound && remaining > 0 && remaining % 10 === 0 && remaining !== lastTickSecond.current) {
                soundGenerator.playTick()
                lastTickSecond.current = remaining
            }
        }, [enableSound, soundGenerator]),

        onWarning: useCallback(() => {
            // Warning at 10 seconds
            if (enableSound) {
                soundGenerator.playWarning()
            }

            if (enableHaptic && isTelegram) {
                hapticFeedback({ type: 'notification', notificationType: 'warning' })
            }
        }, [enableSound, enableHaptic, isTelegram, hapticFeedback, soundGenerator]),
    })

    // Wake Lock API for keeping screen on
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lock = await (navigator as any).wakeLock.request('screen')
                setWakeLock(lock)
            } catch (err) {
                console.warn('Wake Lock request failed:', err)
            }
        }
    }, [])

    const releaseWakeLock = useCallback(() => {
        if (wakeLock) {
            wakeLock.release().catch(() => { })
            setWakeLock(null)
        }
    }, [wakeLock])

    // Handle state changes for wake lock
    useEffect(() => {
        if (state === 'running') {
            requestWakeLock()
        } else {
            releaseWakeLock()
        }
    }, [state, requestWakeLock, releaseWakeLock])

    // Handle visibility change (re-acquire wake lock when visible)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && state === 'running') {
                requestWakeLock()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [state, requestWakeLock])

    // Cleanup wake lock on unmount
    useEffect(() => {
        return () => {
            releaseWakeLock()
        }
    }, [releaseWakeLock])

    // Handle start with haptic
    const handleStart = useCallback(() => {
        if (enableHaptic && isTelegram) {
            hapticFeedback({ type: 'impact', style: 'medium' })
        }
        start()
    }, [enableHaptic, isTelegram, hapticFeedback, start])

    // Handle pause with haptic
    const handlePause = useCallback(() => {
        if (enableHaptic && isTelegram) {
            hapticFeedback({ type: 'impact', style: 'light' })
        }
        pause()
    }, [enableHaptic, isTelegram, hapticFeedback, pause])

    // Handle reset with haptic
    const handleReset = useCallback(() => {
        if (enableHaptic && isTelegram) {
            hapticFeedback({ type: 'impact', style: 'light' })
        }
        reset()
        lastTickSecond.current = 0
    }, [enableHaptic, isTelegram, hapticFeedback, reset])

    // Handle skip with haptic
    const handleSkip = useCallback(() => {
        if (enableHaptic && isTelegram) {
            hapticFeedback({ type: 'impact', style: 'heavy' })
        }
        skip()
        onSkip?.()
    }, [enableHaptic, isTelegram, hapticFeedback, skip, onSkip])

    // Handle preset selection
    const handlePresetSelect = useCallback((presetDuration: number) => {
        if (enableHaptic && isTelegram) {
            hapticFeedback({ type: 'selection' })
        }
        setDuration(presetDuration)
        onDurationChange?.(presetDuration)
        lastTickSecond.current = 0
    }, [enableHaptic, isTelegram, hapticFeedback, setDuration, onDurationChange])

    // Handle add time
    const handleAddTime = useCallback((seconds: number) => {
        if (enableHaptic && isTelegram) {
            hapticFeedback({ type: 'impact', style: 'light' })
        }
        addTime(seconds)
    }, [enableHaptic, isTelegram, hapticFeedback, addTime])

    // SVG ring configuration
    const size = 240
    const strokeWidth = 12
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference

    // Status text based on state
    const statusText = {
        idle: 'Готов к старту',
        running: 'Отдых',
        paused: 'Пауза',
        completed: 'Завершено!',
    }[state]

    return (
        <div className={cn('flex flex-col items-center gap-6 p-6', className)}>
            {/* Circular Progress Timer */}
            <div className="relative" style={{ width: size, height: size }}>
                {/* SVG Ring */}
                <svg
                    className="transform -rotate-90"
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                >
                    {/* Background ring */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-telegram-secondary-bg"
                    />
                    {/* Progress ring */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className={cn(
                            'transition-all duration-100 ease-linear',
                            isWarning ? 'text-warning' : 'text-primary'
                        )}
                    />
                </svg>

                {/* Digital display in center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                        className={cn(
                            'font-mono font-bold tabular-nums leading-none',
                            'text-5xl text-telegram-text',
                            state === 'running' && 'animate-pulse'
                        )}
                        style={{ fontSize: '48px' }}
                    >
                        {formattedTime}
                    </span>
                    <span className={cn(
                        'text-sm mt-2 font-medium',
                        isWarning ? 'text-warning' : 'text-telegram-hint'
                    )}>
                        {statusText}
                    </span>
                </div>
            </div>

            {/* Quick Select Chips */}
            {showQuickSelect && state === 'idle' && (
                <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_PRESETS.map((preset) => (
                        <button
                            key={preset}
                            onClick={() => handlePresetSelect(preset)}
                            className={cn(
                                'px-4 py-2 rounded-full text-sm font-medium',
                                'transition-all duration-200',
                                duration === preset
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-telegram-secondary-bg text-telegram-text hover:bg-neutral-200 dark:hover:bg-neutral-700',
                                'focus:outline-none focus:ring-2 focus:ring-primary/30'
                            )}
                        >
                            {preset < 60 ? `${preset}с` : `${preset / 60} мин`}
                        </button>
                    ))}
                </div>
            )}

            {/* Add time buttons (when running or paused) */}
            {state !== 'idle' && state !== 'completed' && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleAddTime(-10)}
                        disabled={timeLeft <= 10}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium',
                            'bg-telegram-secondary-bg text-telegram-text',
                            'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                            'active:scale-95 transition-all duration-200',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'focus:outline-none focus:ring-2 focus:ring-primary/30'
                        )}
                    >
                        -10с
                    </button>
                    <span className="text-sm text-telegram-hint">Изменить</span>
                    <button
                        onClick={() => handleAddTime(10)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium',
                            'bg-telegram-secondary-bg text-telegram-text',
                            'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                            'active:scale-95 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-primary/30'
                        )}
                    >
                        +10с
                    </button>
                </div>
            )}

            {/* Control Buttons */}
            <div className="flex items-center gap-4">
                {/* Reset button */}
                <button
                    onClick={handleReset}
                    className={cn(
                        'p-4 rounded-full',
                        'bg-telegram-secondary-bg text-telegram-text',
                        'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                        'active:scale-95',
                        'transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30'
                    )}
                    aria-label="Сбросить"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
                        <path d="M3 3v9h9" />
                    </svg>
                </button>

                {/* Start/Pause button */}
                {state === 'running' ? (
                    <button
                        onClick={handlePause}
                        className={cn(
                            'p-5 rounded-full',
                            'bg-primary text-primary-foreground',
                            'shadow-primary',
                            'hover:bg-primary-600 hover:shadow-lg',
                            'active:scale-95',
                            'transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-primary/30'
                        )}
                        aria-label="Пауза"
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                    </button>
                ) : (
                    <button
                        onClick={handleStart}
                        className={cn(
                            'p-5 rounded-full',
                            'bg-primary text-primary-foreground',
                            'shadow-primary',
                            'hover:bg-primary-600 hover:shadow-lg',
                            'active:scale-95',
                            'transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-primary/30'
                        )}
                        aria-label={state === 'idle' ? 'Старт' : 'Продолжить'}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>
                )}

                {/* Skip button */}
                <button
                    onClick={handleSkip}
                    className={cn(
                        'p-4 rounded-full',
                        'bg-telegram-secondary-bg text-telegram-text',
                        'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                        'active:scale-95',
                        'transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30'
                    )}
                    aria-label="Пропустить"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M5 4l10 8-10 8V4z" />
                        <line x1="19" y1="5" x2="19" y2="19" />
                    </svg>
                </button>
            </div>

            {/* Sound toggle */}
            <button
                onClick={() => {
                    // This would toggle sound state in parent component
                }}
                className={cn(
                    'text-xs text-telegram-hint',
                    'hover:text-telegram-text transition-colors'
                )}
            >
                {enableSound ? '🔊 Звук включен' : '🔇 Звук выключен'}
            </button>
        </div>
    )
}

RestTimer.displayName = 'RestTimer'

export default RestTimer
