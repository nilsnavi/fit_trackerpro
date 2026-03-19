/**
 * WorkoutFunctional Page
 * High-Intensity Interval Training (HIIT) / Functional workout screen
 * with work/rest timers, auto-switching, rounds, and live statistics
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp'

// Types
export type IntervalPhase = 'work' | 'rest' | 'prepare'

export interface IntervalExercise {
    id: string
    name: string
    workSeconds: number
    restSeconds: number
    description?: string
}

export interface WorkoutSettings {
    workSeconds: number
    restSeconds: number
    rounds: number
    autoAdvance: boolean
    soundEnabled: boolean
    hapticEnabled: boolean
}

export interface WorkoutStats {
    elapsedSeconds: number
    remainingSeconds: number
    totalCalories: number
    averageHeartRate?: number
    currentRound: number
    completedIntervals: number
}

// Sound generator for interval signals
class IntervalSoundGenerator {
    private audioContext: AudioContext | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass()
            }
        }
    }

    private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
        if (!this.audioContext) return

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
        }

        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = type

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration)
    }

    playWorkStart(): void {
        this.playTone(880, 0.3, 'sine', 0.4)
        setTimeout(() => this.playTone(1100, 0.5, 'sine', 0.4), 150)
    }

    playRestStart(): void {
        this.playTone(600, 0.3, 'sine', 0.3)
        setTimeout(() => this.playTone(500, 0.5, 'sine', 0.3), 150)
    }

    playCountdown(): void {
        this.playTone(800, 0.1, 'triangle', 0.2)
    }

    playComplete(): void {
        this.playTone(1200, 0.2, 'sine', 0.4)
        setTimeout(() => this.playTone(1500, 0.3, 'sine', 0.4), 200)
        setTimeout(() => this.playTone(1800, 0.5, 'sine', 0.4), 500)
    }

    playRoundComplete(): void {
        this.playTone(1000, 0.3, 'sine', 0.4)
        setTimeout(() => this.playTone(1000, 0.3, 'sine', 0.4), 300)
    }
}

// Default exercises for functional workout
const DEFAULT_EXERCISES: IntervalExercise[] = [
    { id: '1', name: 'Jumping Jacks', workSeconds: 45, restSeconds: 15, description: 'Прыжки с разведением рук и ног' },
    { id: '2', name: 'Burpees', workSeconds: 45, restSeconds: 15, description: 'Прыжки с отжиманием' },
    { id: '3', name: 'Mountain Climbers', workSeconds: 45, restSeconds: 15, description: 'Бег в планке' },
    { id: '4', name: 'High Knees', workSeconds: 45, restSeconds: 15, description: 'Бег на месте с высокими коленями' },
    { id: '5', name: 'Squat Jumps', workSeconds: 45, restSeconds: 15, description: 'Прыжки из приседа' },
    { id: '6', name: 'Push-ups', workSeconds: 45, restSeconds: 15, description: 'Отжимания' },
    { id: '7', name: 'Plank to Downward Dog', workSeconds: 45, restSeconds: 15, description: 'Планка в собаку мордой вниз' },
    { id: '8', name: 'Lunges', workSeconds: 45, restSeconds: 15, description: 'Выпады' },
]

export const WorkoutFunctional: React.FC = () => {
    const { hapticFeedback, isTelegram } = useTelegramWebApp()
    const soundGenerator = useRef(new IntervalSoundGenerator()).current

    // Settings
    const [settings, setSettings] = useState<WorkoutSettings>({
        workSeconds: 45,
        restSeconds: 15,
        rounds: 3,
        autoAdvance: true,
        soundEnabled: true,
        hapticEnabled: true,
    })

    // Workout state
    const [exercises, setExercises] = useState<IntervalExercise[]>(DEFAULT_EXERCISES)
    const [currentRound, setCurrentRound] = useState(1)
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
    const [phase, setPhase] = useState<IntervalPhase>('prepare')
    const [timeLeft, setTimeLeft] = useState(10)
    const [isRunning, setIsRunning] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    // Stats
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [totalCalories, setTotalCalories] = useState(0)
    const [heartRate, setHeartRate] = useState<number | null>(null)

    // Refs for timer
    const animationFrameRef = useRef<number | null>(null)
    const lastTimeRef = useRef<number>(0)
    const accumulatedTimeRef = useRef<number>(0)
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)

    const currentExercise = exercises[currentExerciseIndex]
    const totalIntervals = exercises.length * settings.rounds
    const completedIntervals = ((currentRound - 1) * exercises.length) + currentExerciseIndex

    // Calculate total workout time
    const totalWorkoutSeconds = useMemo(() => {
        const exerciseTime = exercises.reduce((sum: number, ex: IntervalExercise) => sum + ex.workSeconds + ex.restSeconds, 0)
        return exerciseTime * settings.rounds
    }, [exercises, settings.rounds])

    const remainingSeconds = Math.max(0, totalWorkoutSeconds - elapsedSeconds)

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Calculate calories (rough estimate: 0.15 cal per second of work)
    const estimatedCalories = Math.floor(elapsedSeconds * 0.12)

    // Wake Lock API
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
            } catch (err) {
                console.warn('Wake Lock request failed:', err)
            }
        }
    }, [])

    const releaseWakeLock = useCallback(() => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release().catch(() => { })
            wakeLockRef.current = null
        }
    }, [])

    // Haptic helper
    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' = 'light') => {
        if (!settings.hapticEnabled || !isTelegram) return

        if (type === 'success') {
            hapticFeedback({ type: 'notification', notificationType: 'success' })
        } else {
            hapticFeedback({ type: 'impact', style: type })
        }
    }, [settings.hapticEnabled, isTelegram, hapticFeedback])

    // Sound helper
    const playSound = useCallback((soundType: 'work' | 'rest' | 'countdown' | 'complete' | 'round') => {
        if (!settings.soundEnabled) return

        switch (soundType) {
            case 'work':
                soundGenerator.playWorkStart()
                break
            case 'rest':
                soundGenerator.playRestStart()
                break
            case 'countdown':
                soundGenerator.playCountdown()
                break
            case 'complete':
                soundGenerator.playComplete()
                break
            case 'round':
                soundGenerator.playRoundComplete()
                break
        }
    }, [settings.soundEnabled])

    // Move to next interval
    const moveToNextInterval = useCallback(() => {
        const nextExerciseIndex = currentExerciseIndex + 1

        if (nextExerciseIndex >= exercises.length) {
            // Round completed
            if (currentRound >= settings.rounds) {
                // Workout completed
                setPhase('prepare')
                setIsRunning(false)
                playSound('complete')
                triggerHaptic('success')
                releaseWakeLock()
                return
            }

            // Next round
            setCurrentRound((prev: number) => prev + 1)
            setCurrentExerciseIndex(0)
            playSound('round')
        } else {
            // Next exercise in current round
            setCurrentExerciseIndex(nextExerciseIndex)
        }

        // Start work phase
        setPhase('work')
        setTimeLeft(currentExercise.workSeconds)
        playSound('work')
        triggerHaptic('medium')
    }, [currentExerciseIndex, currentRound, exercises.length, settings.rounds, currentExercise, playSound, triggerHaptic, releaseWakeLock])

    // Handle phase completion
    const handlePhaseComplete = useCallback(() => {
        if (phase === 'work') {
            // Work done, start rest
            setPhase('rest')
            setTimeLeft(currentExercise.restSeconds)
            playSound('rest')
            triggerHaptic('light')

            // Add calories for completed work interval
            setTotalCalories((prev: number) => prev + Math.floor(currentExercise.workSeconds * 0.15))
        } else if (phase === 'rest') {
            // Rest done, move to next
            if (settings.autoAdvance) {
                moveToNextInterval()
            } else {
                setIsRunning(false)
                setIsPaused(true)
            }
        }
    }, [phase, currentExercise, settings.autoAdvance, moveToNextInterval, playSound, triggerHaptic])

    // Timer tick
    const tick = useCallback((timestamp: number) => {
        if (!isRunning || isPaused) return

        if (!lastTimeRef.current) {
            lastTimeRef.current = timestamp
        }

        const deltaTime = timestamp - lastTimeRef.current
        lastTimeRef.current = timestamp
        accumulatedTimeRef.current += deltaTime

        // Update every 100ms
        if (accumulatedTimeRef.current >= 100) {
            const secondsToSubtract = accumulatedTimeRef.current / 1000
            accumulatedTimeRef.current = accumulatedTimeRef.current % 100

            setTimeLeft((prev: number) => {
                const newTime = Math.max(0, prev - secondsToSubtract)

                // Countdown beeps for last 3 seconds
                if (Math.ceil(newTime) <= 3 && Math.ceil(newTime) > 0 && Math.ceil(newTime) !== Math.ceil(prev)) {
                    playSound('countdown')
                }

                if (newTime <= 0) {
                    handlePhaseComplete()
                    return 0
                }
                return newTime
            })

            setElapsedSeconds((prev: number) => prev + secondsToSubtract)
        }

        if (isRunning && !isPaused) {
            animationFrameRef.current = requestAnimationFrame(tick)
        }
    }, [isRunning, isPaused, handlePhaseComplete, playSound])

    // Start timer
    const startWorkout = useCallback(() => {
        if (phase === 'prepare') {
            setPhase('work')
            setTimeLeft(settings.workSeconds)
        }
        setIsRunning(true)
        setIsPaused(false)
        lastTimeRef.current = 0
        accumulatedTimeRef.current = 0
        triggerHaptic('medium')
        requestWakeLock()
        animationFrameRef.current = requestAnimationFrame(tick)
    }, [phase, settings.workSeconds, tick, triggerHaptic, requestWakeLock])

    // Pause timer
    const pauseWorkout = useCallback(() => {
        setIsPaused(true)
        setIsRunning(false)
        triggerHaptic('light')
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }
    }, [triggerHaptic])

    // Resume timer
    const resumeWorkout = useCallback(() => {
        setIsPaused(false)
        setIsRunning(true)
        lastTimeRef.current = 0
        triggerHaptic('medium')
        animationFrameRef.current = requestAnimationFrame(tick)
    }, [tick, triggerHaptic])

    // Skip to next
    const skipToNext = useCallback(() => {
        triggerHaptic('heavy')
        handlePhaseComplete()
    }, [handlePhaseComplete, triggerHaptic])

    // End workout
    const endWorkout = useCallback(() => {
        setIsRunning(false)
        setIsPaused(false)
        triggerHaptic('success')
        playSound('complete')
        releaseWakeLock()

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }

        // Reset to initial state
        setPhase('prepare')
        setCurrentRound(1)
        setCurrentExerciseIndex(0)
        setTimeLeft(10)
        setElapsedSeconds(0)
    }, [triggerHaptic, playSound, releaseWakeLock])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
            releaseWakeLock()
        }
    }, [releaseWakeLock])

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isRunning && !isPaused) {
                requestWakeLock()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [isRunning, isPaused, requestWakeLock])

    // Progress calculations
    const roundProgress = (currentExerciseIndex / exercises.length) * 100
    const totalProgress = (completedIntervals / totalIntervals) * 100

    // Phase colors
    const phaseColors = {
        work: 'text-danger bg-danger',
        rest: 'text-success bg-success',
        prepare: 'text-warning bg-warning',
    }

    const phaseLabels = {
        work: 'РАБОТА',
        rest: 'ОТДЫХ',
        prepare: 'ПОДГОТОВКА',
    }

    // Circular progress for timer
    const timerSize = 280
    const strokeWidth = 16
    const radius = (timerSize - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const currentPhaseDuration = phase === 'work' ? currentExercise?.workSeconds :
        phase === 'rest' ? currentExercise?.restSeconds : 10
    const progressPercent = currentPhaseDuration ? ((currentPhaseDuration - timeLeft) / currentPhaseDuration) * 100 : 0
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference

    return (
        <div className="min-h-screen bg-telegram-bg">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-telegram-secondary-bg px-4 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-telegram-text">HIIT Тренировка</h1>
                        <p className="text-xs text-telegram-hint">Функциональный тренинг</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </Button>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-4 space-y-4">
                {/* Round Indicator */}
                <Card variant="info" className="!p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-telegram-text">
                            Круг {currentRound} из {settings.rounds}
                        </span>
                        <span className="text-xs text-telegram-hint">
                            {completedIntervals} / {totalIntervals} интервалов
                        </span>
                    </div>
                    <ProgressBar
                        value={completedIntervals}
                        max={totalIntervals}
                        size="sm"
                        color="gradient"
                        showLabel
                        labelFormat="fraction"
                    />
                </Card>

                {/* Settings Panel */}
                {showSettings && (
                    <Card variant="info" className="!p-4 space-y-4">
                        <h3 className="font-semibold text-telegram-text">Настройки</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-telegram-hint block mb-1">Работа (сек)</label>
                                <input
                                    type="number"
                                    value={settings.workSeconds}
                                    onChange={(e) => setSettings(s => ({ ...s, workSeconds: parseInt(e.target.value) || 30 }))}
                                    className="w-full px-3 py-2 rounded-lg bg-telegram-secondary-bg text-telegram-text text-center"
                                    min="5"
                                    max="300"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-telegram-hint block mb-1">Отдых (сек)</label>
                                <input
                                    type="number"
                                    value={settings.restSeconds}
                                    onChange={(e) => setSettings(s => ({ ...s, restSeconds: parseInt(e.target.value) || 10 }))}
                                    className="w-full px-3 py-2 rounded-lg bg-telegram-secondary-bg text-telegram-text text-center"
                                    min="5"
                                    max="120"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-telegram-hint block mb-1">Круги</label>
                                <input
                                    type="number"
                                    value={settings.rounds}
                                    onChange={(e) => setSettings(s => ({ ...s, rounds: parseInt(e.target.value) || 1 }))}
                                    className="w-full px-3 py-2 rounded-lg bg-telegram-secondary-bg text-telegram-text text-center"
                                    min="1"
                                    max="10"
                                />
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.autoAdvance}
                                        onChange={(e) => setSettings(s => ({ ...s, autoAdvance: e.target.checked }))}
                                        className="w-4 h-4 rounded"
                                    />
                                    <span className="text-xs text-telegram-text">Авто-переход</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.soundEnabled}
                                    onChange={(e) => setSettings(s => ({ ...s, soundEnabled: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-xs text-telegram-text">🔊 Звук</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.hapticEnabled}
                                    onChange={(e) => setSettings(s => ({ ...s, hapticEnabled: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-xs text-telegram-text">📳 Вибрация</span>
                            </label>
                        </div>
                    </Card>
                )}

                {/* Current Interval Display */}
                <Card variant="workout" className={cn('!p-6 text-center', phase === 'work' && 'border-2 border-danger', phase === 'rest' && 'border-2 border-success')}>
                    {/* Phase Badge */}
                    <div className={cn(
                        'inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4',
                        phase === 'work' && 'bg-danger/10 text-danger',
                        phase === 'rest' && 'bg-success/10 text-success',
                        phase === 'prepare' && 'bg-warning/10 text-warning'
                    )}>
                        <span className={cn('w-2 h-2 rounded-full animate-pulse', phaseColors[phase].split(' ')[1])} />
                        <span className="font-bold text-sm tracking-wide">{phaseLabels[phase]}</span>
                    </div>

                    {/* Exercise Name */}
                    <h2 className="text-xl font-bold text-telegram-text mb-6">
                        {phase === 'prepare' ? 'Приготовьтесь!' : currentExercise?.name}
                    </h2>

                    {/* Circular Timer */}
                    <div className="relative mx-auto mb-6" style={{ width: timerSize, height: timerSize }}>
                        <svg
                            className="transform -rotate-90"
                            width={timerSize}
                            height={timerSize}
                            viewBox={`0 0 ${timerSize} ${timerSize}`}
                        >
                            <circle
                                cx={timerSize / 2}
                                cy={timerSize / 2}
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={strokeWidth}
                                className="text-telegram-secondary-bg"
                            />
                            <circle
                                cx={timerSize / 2}
                                cy={timerSize / 2}
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className={cn(
                                    'transition-all duration-100 ease-linear',
                                    phase === 'work' && 'text-danger',
                                    phase === 'rest' && 'text-success',
                                    phase === 'prepare' && 'text-warning'
                                )}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-6xl font-mono font-bold text-telegram-text tabular-nums">
                                {formatTime(Math.ceil(timeLeft))}
                            </span>
                            <span className="text-sm text-telegram-hint mt-2">
                                {phase === 'work' ? 'Выполняйте упражнение' : phase === 'rest' ? 'Восстановление' : 'Начинаем через...'}
                            </span>
                        </div>
                    </div>

                    {/* Exercise Description */}
                    {phase !== 'prepare' && currentExercise?.description && (
                        <p className="text-sm text-telegram-hint">{currentExercise.description}</p>
                    )}
                </Card>

                {/* Interval Plan */}
                <Card variant="info" className="!p-4">
                    <h3 className="font-semibold text-telegram-text mb-3">План тренировки</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {exercises.map((exercise, index) => {
                            const isActive = index === currentExerciseIndex && phase !== 'prepare'
                            const isCompleted = index < currentExerciseIndex || (index === currentExerciseIndex && phase === 'rest' && timeLeft < exercise.restSeconds)

                            return (
                                <div
                                    key={exercise.id}
                                    className={cn(
                                        'flex items-center justify-between p-3 rounded-xl transition-all',
                                        isActive && 'bg-primary/10 border border-primary/30',
                                        isCompleted && 'opacity-50',
                                        !isActive && !isCompleted && 'bg-telegram-secondary-bg'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                                            isActive ? 'bg-primary text-white' :
                                                isCompleted ? 'bg-success text-white' : 'bg-telegram-hint/20 text-telegram-hint'
                                        )}>
                                            {isCompleted ? '✓' : index + 1}
                                        </span>
                                        <span className={cn(
                                            'text-sm font-medium',
                                            isActive ? 'text-primary' : 'text-telegram-text'
                                        )}>
                                            {exercise.name}
                                        </span>
                                    </div>
                                    <span className="text-xs text-telegram-hint">
                                        {exercise.workSeconds}с
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </Card>

                {/* Live Stats */}
                <Card variant="stats" className="!p-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold">{formatTime(elapsedSeconds)}</p>
                            <p className="text-xs opacity-80">Прошло</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{formatTime(remainingSeconds)}</p>
                            <p className="text-xs opacity-80">Осталось</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{estimatedCalories}</p>
                            <p className="text-xs opacity-80">Ккал</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{heartRate || '--'}</p>
                            <p className="text-xs opacity-80">Пульс</p>
                        </div>
                    </div>
                </Card>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3 pt-2">
                    {/* End Workout */}
                    <Button
                        variant="emergency"
                        size="lg"
                        className="!px-4"
                        onClick={endWorkout}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                    </Button>

                    {/* Main Control */}
                    {!isRunning ? (
                        <Button
                            variant="primary"
                            size="lg"
                            className="!px-12"
                            onClick={isPaused ? resumeWorkout : startWorkout}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                            {isPaused ? 'Продолжить' : 'СТАРТ'}
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            size="lg"
                            className="!px-12"
                            onClick={pauseWorkout}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                            ПАУЗА
                        </Button>
                    )}

                    {/* Skip */}
                    <Button
                        variant="secondary"
                        size="lg"
                        className="!px-4"
                        onClick={skipToNext}
                        disabled={phase === 'prepare'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4l10 8-10 8V4zm12 0v16h2V4h-2z" />
                        </svg>
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default WorkoutFunctional
