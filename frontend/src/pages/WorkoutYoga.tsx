/**
 * WorkoutYoga - Yoga Session Screen
 * Minimalist design with flexible timer, background sounds, and screen wake lock
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Play,
    Pause,
    RotateCcw,
    Check,
    Wind,
    Clock,
    Activity,
    Volume2,
    VolumeX,
    Sun,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react'
import { useTelegram } from '@hooks/useTelegram'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { cn } from '@/utils/cn'
import { workoutsApi } from '@/services/workouts'
import type { WorkoutCompleteRequest } from '@/types/workouts'

// Yoga modes
type YogaMode = 'asana' | 'session' | 'breathing'

// Background sound types
type BackgroundSound = 'off' | 'ocean' | 'zen' | 'rain'

// Sound options
const SOUND_OPTIONS: { value: BackgroundSound; label: string; icon: string }[] = [
    { value: 'off', label: 'Выкл', icon: '🔇' },
    { value: 'ocean', label: 'Океан', icon: '🌊' },
    { value: 'zen', label: 'Дзен', icon: '🧘' },
    { value: 'rain', label: 'Дождь', icon: '🌧️' },
]

// Completion sounds
const COMPLETION_SOUNDS = [
    { value: 'bell', label: 'Колокол' },
    { value: 'bowl', label: 'Чаша' },
    { value: 'chime', label: 'Звонок' },
    { value: 'none', label: 'Без звука' },
]

// Box breathing phases
const BREATHING_PHASES = [
    { name: 'Вдох', duration: 4, color: 'text-success' },
    { name: 'Задержка', duration: 4, color: 'text-warning' },
    { name: 'Выдох', duration: 4, color: 'text-primary' },
    { name: 'Пауза', duration: 4, color: 'text-telegram-hint' },
]

/**
 * Sound Generator using Web Audio API
 * Generates ambient sounds and tones without external files
 */
class SoundGenerator {
    private audioContext: AudioContext | null = null
    private oscillators: (OscillatorNode | AudioBufferSourceNode)[] = []
    private gainNodes: GainNode[] = []
    private isPlaying = false
    private currentSound: BackgroundSound = 'off'

    constructor() {
        if (typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass()
            }
        }
    }

    private createNoiseBuffer(): AudioBuffer | null {
        if (!this.audioContext) return null
        const bufferSize = 2 * this.audioContext.sampleRate
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
        const output = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1
        }
        return buffer
    }

    private createBrownNoiseBuffer(): AudioBuffer | null {
        if (!this.audioContext) return null
        const bufferSize = 2 * this.audioContext.sampleRate
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
        const output = buffer.getChannelData(0)
        let lastOut = 0
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1
            output[i] = (lastOut + (0.02 * white)) / 1.02
            lastOut = output[i]
            output[i] *= 3.5
        }
        return buffer
    }

    playOcean(): void {
        if (!this.audioContext) return
        this.stop()

        const buffer = this.createBrownNoiseBuffer()
        if (!buffer) return

        const noise = this.audioContext.createBufferSource()
        noise.buffer = buffer
        noise.loop = true

        const filter = this.audioContext.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 400

        const gain = this.audioContext.createGain()
        gain.gain.value = 0.15

        // LFO for wave effect
        const lfo = this.audioContext.createOscillator()
        lfo.frequency.value = 0.1
        const lfoGain = this.audioContext.createGain()
        lfoGain.gain.value = 0.05

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this.audioContext.destination)

        lfo.connect(lfoGain)
        lfoGain.connect(gain.gain)

        noise.start()
        lfo.start()

        this.oscillators = [noise, lfo]
        this.gainNodes = [gain, lfoGain]
        this.isPlaying = true
        this.currentSound = 'ocean'
    }

    playZen(): void {
        if (!this.audioContext) return
        this.stop()

        // Create drone sound
        const freqs = [110, 164.81, 196] // A2, E3, G3
        freqs.forEach((freq) => {
            const osc = this.audioContext!.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = freq

            const gain = this.audioContext!.createGain()
            gain.gain.value = 0.08

            osc.connect(gain)
            gain.connect(this.audioContext!.destination)
            osc.start()

            this.oscillators.push(osc)
            this.gainNodes.push(gain)
        })

        this.isPlaying = true
        this.currentSound = 'zen'
    }

    playRain(): void {
        if (!this.audioContext) return
        this.stop()

        const buffer = this.createNoiseBuffer()
        if (!buffer) return

        const noise = this.audioContext.createBufferSource()
        noise.buffer = buffer
        noise.loop = true

        const filter = this.audioContext.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 800

        const gain = this.audioContext.createGain()
        gain.gain.value = 0.1

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this.audioContext.destination)

        noise.start()

        this.oscillators = [noise]
        this.gainNodes = [gain]
        this.isPlaying = true
        this.currentSound = 'rain'
    }

    stop(): void {
        this.oscillators.forEach(osc => {
            try {
                osc.stop()
            } catch {
                // Ignore already stopped sources.
            }
        })
        this.oscillators = []
        this.gainNodes = []
        this.isPlaying = false
        this.currentSound = 'off'
    }

    playCompletionSound(type: string): void {
        if (!this.audioContext) return

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
        }

        const now = this.audioContext.currentTime

        switch (type) {
            case 'bell':
                this.playTone(523.25, 0.5, now, 'sine')
                this.playTone(659.25, 0.5, now + 0.1, 'sine')
                break
            case 'bowl':
                this.playTone(180, 1.5, now, 'sine')
                break
            case 'chime':
                this.playTone(880, 0.3, now, 'sine')
                break
        }
    }

    private playTone(frequency: number, duration: number, startTime: number, type: OscillatorType): void {
        if (!this.audioContext) return

        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()

        osc.type = type
        osc.frequency.value = frequency

        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

        osc.connect(gain)
        gain.connect(this.audioContext.destination)

        osc.start(startTime)
        osc.stop(startTime + duration)
    }

    get isActive(): boolean {
        return this.isPlaying
    }

    get current(): BackgroundSound {
        return this.currentSound
    }
}

// Circular Progress Timer Component
interface CircularTimerProps {
    timeLeft: number
    duration: number
    mode: YogaMode
    breathingPhase?: number
    isRunning: boolean
    size?: number
}

function CircularTimer({
    timeLeft,
    duration,
    mode,
    breathingPhase = 0,
    isRunning,
    size = 280
}: CircularTimerProps) {
    const radius = (size - 16) / 2
    const circumference = 2 * Math.PI * radius
    const progress = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0
    const strokeDashoffset = circumference - (progress / 100) * circumference

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const getStatusText = () => {
        if (mode === 'breathing' && isRunning) {
            return BREATHING_PHASES[breathingPhase].name
        }
        if (!isRunning && timeLeft === duration) return 'Готов'
        if (!isRunning) return 'Пауза'
        return mode === 'asana' ? 'Асана' : mode === 'breathing' ? 'Дыхание' : 'Сессия'
    }

    const getRingColor = () => {
        if (mode === 'breathing' && isRunning) {
            return BREATHING_PHASES[breathingPhase].color.replace('text-', 'text-')
        }
        return 'text-primary'
    }

    return (
        <div className="relative" style={{ width: size, height: size }}>
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
                    strokeWidth={8}
                    className="text-telegram-secondary-bg/50"
                />
                {/* Progress ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className={cn(
                        'transition-all duration-1000 ease-linear',
                        getRingColor()
                    )}
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                    'font-mono font-bold tabular-nums leading-none text-telegram-text',
                    isRunning ? 'animate-pulse' : ''
                )} style={{ fontSize: '56px' }}>
                    {formatTime(timeLeft)}
                </span>
                <span className={cn(
                    'text-sm mt-2 font-medium',
                    mode === 'breathing' && isRunning ? BREATHING_PHASES[breathingPhase].color : 'text-telegram-hint'
                )}>
                    {getStatusText()}
                </span>
            </div>
        </div>
    )
}

// Mode Selector Component
interface ModeSelectorProps {
    currentMode: YogaMode
    onModeChange: (mode: YogaMode) => void
}

function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
    const modes: { value: YogaMode; label: string; icon: React.ReactNode }[] = [
        { value: 'asana', label: 'Асана', icon: <Activity className="w-4 h-4" /> },
        { value: 'session', label: 'Сессия', icon: <Clock className="w-4 h-4" /> },
        { value: 'breathing', label: 'Дыхание', icon: <Wind className="w-4 h-4" /> },
    ]

    return (
        <div className="flex items-center gap-2 p-1 bg-telegram-secondary-bg/50 rounded-2xl">
            {modes.map((mode) => (
                <button
                    key={mode.value}
                    onClick={() => onModeChange(mode.value)}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        currentMode === mode.value
                            ? 'bg-telegram-bg text-telegram-text shadow-sm'
                            : 'text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    {mode.icon}
                    {mode.label}
                </button>
            ))}
        </div>
    )
}

// Settings Panel Component
interface SettingsPanelProps {
    duration: number
    onDurationChange: (duration: number) => void
    completionSound: string
    onCompletionSoundChange: (sound: string) => void
    repetitions: number
    onRepetitionsChange: (reps: number) => void
    keepAwake: boolean
    onKeepAwakeChange: (value: boolean) => void
    backgroundSound: BackgroundSound
    onBackgroundSoundChange: (sound: BackgroundSound) => void
}

function SettingsPanel({
    duration,
    onDurationChange,
    completionSound,
    onCompletionSoundChange,
    repetitions,
    onRepetitionsChange,
    keepAwake,
    onKeepAwakeChange,
    backgroundSound,
    onBackgroundSoundChange,
}: SettingsPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const durationPresets = [60, 120, 180, 300, 600, 900]

    return (
        <div className="bg-telegram-secondary-bg/30 rounded-2xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 text-telegram-text"
            >
                <span className="font-medium">Настройки</span>
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* Duration */}
                    <div className="space-y-2">
                        <label className="text-sm text-telegram-hint">Длительность</label>
                        <div className="flex flex-wrap gap-2">
                            {durationPresets.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => onDurationChange(preset)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                                        duration === preset
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-telegram-bg text-telegram-text hover:bg-neutral-200'
                                    )}
                                >
                                    {preset < 60 ? `${preset}с` : `${preset / 60} мин`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Completion Sound */}
                    <div className="space-y-2">
                        <label className="text-sm text-telegram-hint">Звук завершения</label>
                        <div className="flex flex-wrap gap-2">
                            {COMPLETION_SOUNDS.map((sound) => (
                                <button
                                    key={sound.value}
                                    onClick={() => onCompletionSoundChange(sound.value)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                                        completionSound === sound.value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-telegram-bg text-telegram-text hover:bg-neutral-200'
                                    )}
                                >
                                    {sound.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Repetitions */}
                    <div className="space-y-2">
                        <label className="text-sm text-telegram-hint">Повторы (циклы)</label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onRepetitionsChange(Math.max(1, repetitions - 1))}
                                className="w-10 h-10 rounded-xl bg-telegram-bg text-telegram-text font-medium hover:bg-neutral-200"
                            >
                                -
                            </button>
                            <span className="w-12 text-center font-medium text-telegram-text">{repetitions}</span>
                            <button
                                onClick={() => onRepetitionsChange(repetitions + 1)}
                                className="w-10 h-10 rounded-xl bg-telegram-bg text-telegram-text font-medium hover:bg-neutral-200"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Keep Awake */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sun className="w-4 h-4 text-telegram-hint" />
                            <span className="text-sm text-telegram-text">Не гасить экран</span>
                        </div>
                        <button
                            onClick={() => onKeepAwakeChange(!keepAwake)}
                            className={cn(
                                'w-12 h-6 rounded-full transition-colors relative',
                                keepAwake ? 'bg-primary' : 'bg-telegram-secondary-bg'
                            )}
                        >
                            <span className={cn(
                                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                keepAwake ? 'left-7' : 'left-1'
                            )} />
                        </button>
                    </div>

                    {/* Background Sound */}
                    <div className="space-y-2">
                        <label className="text-sm text-telegram-hint">Фоновый звук</label>
                        <div className="flex flex-wrap gap-2">
                            {SOUND_OPTIONS.map((sound) => (
                                <button
                                    key={sound.value}
                                    onClick={() => onBackgroundSoundChange(sound.value)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                                        backgroundSound === sound.value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-telegram-bg text-telegram-text hover:bg-neutral-200'
                                    )}
                                >
                                    <span>{sound.icon}</span>
                                    {sound.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Main Component
export function WorkoutYoga() {
    const { hapticFeedback, showMainButton, hideMainButton } = useTelegram()
    const soundGenerator = useRef(new SoundGenerator()).current
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)

    // State
    const [mode, setMode] = useState<YogaMode>('asana')
    const [backendWorkoutId, setBackendWorkoutId] = useState<number | null>(null)
    const [duration, setDuration] = useState(180) // 3 minutes default
    const [timeLeft, setTimeLeft] = useState(180)
    const [isRunning, setIsRunning] = useState(false)
    const [, setIsPaused] = useState(false)
    const [currentRep, setCurrentRep] = useState(1)
    const [repetitions, setRepetitions] = useState(1)
    const [completionSound, setCompletionSound] = useState('bowl')
    const [keepAwake, setKeepAwake] = useState(true)
    const [backgroundSound, setBackgroundSound] = useState<BackgroundSound>('off')
    const [comment, setComment] = useState('')
    const [showComment, setShowComment] = useState(false)
    const [breathingPhase, setBreathingPhase] = useState(0)
    const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)

    // Timer interval ref
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Request wake lock
    const requestWakeLock = useCallback(async () => {
        if (!keepAwake) return
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
            } catch (err) {
                console.warn('Wake Lock request failed:', err)
            }
        }
    }, [keepAwake])

    // Release wake lock
    const releaseWakeLock = useCallback(() => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release().catch(() => { })
            wakeLockRef.current = null
        }
    }, [])

    // Handle background sound change
    const handleBackgroundSoundChange = useCallback((sound: BackgroundSound) => {
        setBackgroundSound(sound)

        if (sound === 'off') {
            soundGenerator.stop()
        } else if (isRunning) {
            switch (sound) {
                case 'ocean':
                    soundGenerator.playOcean()
                    break
                case 'zen':
                    soundGenerator.playZen()
                    break
                case 'rain':
                    soundGenerator.playRain()
                    break
            }
        }
    }, [isRunning, soundGenerator])

    // Start timer
    const startTimer = useCallback(() => {
        if (!isRunning) {
            if (!backendWorkoutId) {
                void workoutsApi.startWorkout({
                    name: `Yoga - ${mode}`,
                    type: 'flexibility',
                })
                    .then((response) => setBackendWorkoutId(response.id))
                    .catch((error) => console.error('Failed to start yoga session on backend:', error))
            }

            setIsRunning(true)
            setIsPaused(false)
            if (!sessionStartTime) {
                setSessionStartTime(new Date())
            }

            hapticFeedback?.medium()
            requestWakeLock()

            // Start background sound if selected
            if (backgroundSound !== 'off' && !soundGenerator.isActive) {
                switch (backgroundSound) {
                    case 'ocean':
                        soundGenerator.playOcean()
                        break
                    case 'zen':
                        soundGenerator.playZen()
                        break
                    case 'rain':
                        soundGenerator.playRain()
                        break
                }
            }
        }
    }, [isRunning, sessionStartTime, hapticFeedback, requestWakeLock, backgroundSound, soundGenerator, backendWorkoutId, mode])

    // Pause timer
    const pauseTimer = useCallback(() => {
        if (isRunning) {
            setIsRunning(false)
            setIsPaused(true)
            hapticFeedback?.light()
            releaseWakeLock()
        }
    }, [isRunning, hapticFeedback, releaseWakeLock])

    // Reset timer
    const resetTimer = useCallback(() => {
        setIsRunning(false)
        setIsPaused(false)
        setTimeLeft(duration)
        setCurrentRep(1)
        setBreathingPhase(0)
        hapticFeedback?.light()
        releaseWakeLock()
        soundGenerator.stop()
    }, [duration, hapticFeedback, releaseWakeLock, soundGenerator])

    // Complete session
    const completeSession = useCallback(() => {
        const sessionData = {
            mode,
            duration: sessionStartTime
                ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
                : duration * repetitions - timeLeft,
            repetitions: currentRep,
            comment: comment || undefined,
            completedAt: new Date().toISOString(),
        }

        // Save to localStorage
        const sessions = JSON.parse(localStorage.getItem('yoga_sessions') || '[]')
        sessions.push(sessionData)
        localStorage.setItem('yoga_sessions', JSON.stringify(sessions))

        const elapsedSeconds = sessionStartTime
            ? Math.max(1, Math.floor((Date.now() - sessionStartTime.getTime()) / 1000))
            : Math.max(1, duration * repetitions - timeLeft)
        const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
        const completionPayload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: [
                {
                    exercise_id: 1,
                    name: `Yoga ${mode}`,
                    sets_completed: [
                        {
                            set_number: currentRep,
                            duration: elapsedSeconds,
                            completed: true,
                        },
                    ],
                    notes: comment || undefined,
                },
            ],
            comments: comment || `Yoga mode: ${mode}`,
            tags: ['flexibility', 'yoga', mode],
        }

        if (backendWorkoutId) {
            void workoutsApi.completeWorkout(backendWorkoutId, completionPayload).catch((error) => {
                console.error('Failed to complete yoga workout on backend:', error)
            })
        }

        hapticFeedback?.success()
        soundGenerator.playCompletionSound(completionSound)
        releaseWakeLock()
        soundGenerator.stop()

        // Navigate back
        window.history.back()
    }, [mode, sessionStartTime, duration, repetitions, timeLeft, currentRep, comment, hapticFeedback, soundGenerator, releaseWakeLock, completionSound, backendWorkoutId])

    // Timer effect
    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        // Timer completed
                        if (currentRep < repetitions) {
                            // Next repetition
                            setCurrentRep((r) => r + 1)
                            soundGenerator.playCompletionSound(completionSound)
                            hapticFeedback?.success()
                            return duration
                        } else {
                            // All repetitions completed
                            setIsRunning(false)
                            soundGenerator.playCompletionSound(completionSound)
                            hapticFeedback?.success()
                            releaseWakeLock()
                            return 0
                        }
                    }
                    return prev - 1
                })

                // Update breathing phase for box breathing mode
                if (mode === 'breathing') {
                    const cyclePosition = (duration - timeLeft) % 16
                    const newPhase = Math.floor(cyclePosition / 4)
                    setBreathingPhase(newPhase)
                }
            }, 1000)
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [isRunning, duration, repetitions, currentRep, timeLeft, mode, hapticFeedback, soundGenerator, releaseWakeLock, completionSound])

    // Handle mode change
    const handleModeChange = useCallback((newMode: YogaMode) => {
        setMode(newMode)
        setIsRunning(false)
        setIsPaused(false)
        setCurrentRep(1)
        setBreathingPhase(0)
        releaseWakeLock()
        soundGenerator.stop()

        // Set default duration based on mode
        switch (newMode) {
            case 'asana':
                setDuration(180)
                setTimeLeft(180)
                break
            case 'session':
                setDuration(1800)
                setTimeLeft(1800)
                break
            case 'breathing':
                setDuration(240)
                setTimeLeft(240)
                setRepetitions(5)
                break
        }
    }, [releaseWakeLock, soundGenerator])

    // Handle duration change
    const handleDurationChange = useCallback((newDuration: number) => {
        setDuration(newDuration)
        setTimeLeft(newDuration)
        setIsRunning(false)
        setIsPaused(false)
    }, [])

    // Telegram Main Button
    useEffect(() => {
        if (isRunning || timeLeft < duration) {
            showMainButton('Завершить сессию', completeSession)
        } else {
            hideMainButton()
        }

        return () => {
            hideMainButton()
        }
    }, [isRunning, timeLeft, duration, completeSession, showMainButton, hideMainButton])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            releaseWakeLock()
            soundGenerator.stop()
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [releaseWakeLock, soundGenerator])

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isRunning && keepAwake) {
                requestWakeLock()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isRunning, keepAwake, requestWakeLock])

    return (
        <div className="min-h-screen bg-telegram-bg pb-32">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm safe-area-top">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-telegram-text">Йога</h1>
                            <p className="text-sm text-telegram-hint">
                                {currentRep > 1 && `${currentRep}/${repetitions} • `}
                                {mode === 'asana' ? 'Таймер на позу' : mode === 'breathing' ? 'Box breathing' : 'Общее время'}
                            </p>
                        </div>
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 rounded-full hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <X className="w-5 h-5 text-telegram-hint" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 py-6 space-y-8">
                {/* Mode Selector */}
                <div className="flex justify-center">
                    <ModeSelector currentMode={mode} onModeChange={handleModeChange} />
                </div>

                {/* Timer Display */}
                <div className="flex justify-center">
                    <CircularTimer
                        timeLeft={timeLeft}
                        duration={duration}
                        mode={mode}
                        breathingPhase={breathingPhase}
                        isRunning={isRunning}
                    />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                    {/* Reset */}
                    <button
                        onClick={resetTimer}
                        className="p-4 rounded-full bg-telegram-secondary-bg text-telegram-text hover:bg-neutral-200 transition-all active:scale-95"
                        aria-label="Сбросить"
                    >
                        <RotateCcw className="w-6 h-6" />
                    </button>

                    {/* Play/Pause */}
                    {isRunning ? (
                        <button
                            onClick={pauseTimer}
                            className="p-6 rounded-full bg-primary text-primary-foreground shadow-primary hover:bg-primary-600 transition-all active:scale-95"
                            aria-label="Пауза"
                        >
                            <Pause className="w-8 h-8" />
                        </button>
                    ) : (
                        <button
                            onClick={startTimer}
                            className="p-6 rounded-full bg-primary text-primary-foreground shadow-primary hover:bg-primary-600 transition-all active:scale-95"
                            aria-label="Старт"
                        >
                            <Play className="w-8 h-8 ml-1" />
                        </button>
                    )}

                    {/* Complete */}
                    <button
                        onClick={completeSession}
                        className="p-4 rounded-full bg-success/10 text-success hover:bg-success/20 transition-all active:scale-95"
                        aria-label="Завершить"
                    >
                        <Check className="w-6 h-6" />
                    </button>
                </div>

                {/* Settings */}
                <SettingsPanel
                    duration={duration}
                    onDurationChange={handleDurationChange}
                    completionSound={completionSound}
                    onCompletionSoundChange={setCompletionSound}
                    repetitions={repetitions}
                    onRepetitionsChange={setRepetitions}
                    keepAwake={keepAwake}
                    onKeepAwakeChange={setKeepAwake}
                    backgroundSound={backgroundSound}
                    onBackgroundSoundChange={handleBackgroundSoundChange}
                />

                {/* Comment Field */}
                <div className="space-y-2">
                    <button
                        onClick={() => setShowComment(!showComment)}
                        className="flex items-center gap-2 text-sm text-telegram-hint hover:text-telegram-text transition-colors"
                    >
                        <MessageSquare className="w-4 h-4" />
                        {showComment ? 'Скрыть заметку' : 'Добавить заметку'}
                    </button>

                    {showComment && (
                        <Input
                            type="text"
                            placeholder="Например: упор на спину"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full"
                        />
                    )}
                </div>

                {/* Session Info */}
                {sessionStartTime && (
                    <div className="text-center text-sm text-telegram-hint">
                        Сессия начата: {sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>

            {/* Background Sound Indicator */}
            {backgroundSound !== 'off' && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-telegram-secondary-bg/80 backdrop-blur rounded-full text-sm text-telegram-hint">
                    {soundGenerator.isActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>{SOUND_OPTIONS.find(s => s.value === backgroundSound)?.label}</span>
                </div>
            )}

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-telegram-bg border-t border-border safe-area-bottom p-4 z-20">
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={completeSession}
                    haptic="medium"
                >
                    Завершить сессию
                </Button>
            </div>
        </div>
    )
}

export default WorkoutYoga
