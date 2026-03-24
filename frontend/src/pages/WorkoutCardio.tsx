/**
 * WorkoutCardio - Экран кардио тренировки для FitTracker Pro
 * 
 * Функции:
 * - Таймер сессии (вперёд)
 * - Выбор оборудования с иконками
 * - Ввод параметров (скорость, наклон, пульс)
 * - Заметки по времени
 * - Мини-график скорости (sparkline)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
    Play,
    Pause,
    Square,
    Flag,
    ChevronDown,
    Plus,
    Clock,
    Heart,
    TrendingUp,
    Activity,
    Bike,
    Zap,
    MoreHorizontal,
    X,
    Minus,
    Plus as PlusIcon,
    Trash2
} from 'lucide-react'
import { useTelegram } from '@hooks/useTelegram'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { cn } from '@/utils/cn'
import { workoutsApi } from '@/services/workouts'
import type { WorkoutCompleteRequest } from '@/types/workouts'

// Types
interface Equipment {
    id: string
    name: string
    icon: React.ReactNode
    hasIncline: boolean
}

interface TimelineNote {
    id: string
    timestamp: number
    elapsedSeconds: number
    text: string
}

interface SpeedDataPoint {
    elapsedSeconds: number
    speed: number
}

interface CardioSession {
    id: string
    equipmentId: string
    startedAt: Date
    elapsedSeconds: number
    speed: number
    incline: number
    heartRate?: number
    notes: TimelineNote[]
    speedHistory: SpeedDataPoint[]
    isActive: boolean
}

// Equipment options
const EQUIPMENT_OPTIONS: Equipment[] = [
    {
        id: 'treadmill',
        name: 'Беговая дорожка',
        icon: <Activity className="w-5 h-5" />,
        hasIncline: true,
    },
    {
        id: 'elliptical',
        name: 'Эллипс',
        icon: <Zap className="w-5 h-5" />,
        hasIncline: true,
    },
    {
        id: 'bike',
        name: 'Велотренажёр',
        icon: <Bike className="w-5 h-5" />,
        hasIncline: false,
    },
    {
        id: 'other',
        name: 'Другое',
        icon: <MoreHorizontal className="w-5 h-5" />,
        hasIncline: false,
    },
]

// Sparkline Chart Component
interface SparklineProps {
    data: SpeedDataPoint[]
    width?: number
    height?: number
    onPointClick?: (point: SpeedDataPoint) => void
}

function Sparkline({ data, width = 300, height = 80, onPointClick }: SparklineProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    if (data.length < 2) {
        return (
            <div
                className="flex items-center justify-center bg-telegram-secondary-bg/50 rounded-xl"
                style={{ width, height }}
            >
                <span className="text-sm text-telegram-hint">Нет данных</span>
            </div>
        )
    }

    const padding = 8
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const speeds = data.map(d => d.speed)
    const minSpeed = Math.min(...speeds) * 0.9
    const maxSpeed = Math.max(...speeds) * 1.1
    const speedRange = maxSpeed - minSpeed || 1

    const maxElapsed = Math.max(...data.map(d => d.elapsedSeconds), 1)

    const getX = (elapsed: number) => padding + (elapsed / maxElapsed) * chartWidth
    const getY = (speed: number) => padding + chartHeight - ((speed - minSpeed) / speedRange) * chartHeight

    // Generate path
    const pathData = data.map((point, i) => {
        const x = getX(point.elapsedSeconds)
        const y = getY(point.speed)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')

    // Generate area path
    const areaPath = `${pathData} L ${getX(data[data.length - 1].elapsedSeconds)} ${height - padding} L ${padding} ${height - padding} Z`

    return (
        <div className="relative" style={{ width, height }}>
            <svg
                width={width}
                height={height}
                className="overflow-visible"
                onMouseLeave={() => setHoveredIndex(null)}
            >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <line
                        key={i}
                        x1={padding}
                        y1={padding + chartHeight * ratio}
                        x2={width - padding}
                        y2={padding + chartHeight * ratio}
                        stroke="currentColor"
                        strokeWidth={1}
                        className="text-telegram-hint/20"
                        strokeDasharray="2,2"
                    />
                ))}

                {/* Area fill */}
                <path
                    d={areaPath}
                    fill="currentColor"
                    className="text-primary/20"
                />

                {/* Line */}
                <path
                    d={pathData}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                />

                {/* Data points */}
                {data.map((point, i) => {
                    const x = getX(point.elapsedSeconds)
                    const y = getY(point.speed)
                    const isHovered = hoveredIndex === i

                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r={isHovered ? 5 : 3}
                            fill="currentColor"
                            className={cn(
                                "text-primary cursor-pointer transition-all duration-200",
                                isHovered && "text-primary-600"
                            )}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onClick={() => onPointClick?.(point)}
                        />
                    )
                })}
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && (
                <div className="absolute top-0 right-0 bg-telegram-bg border border-border rounded-lg px-2 py-1 shadow-lg">
                    <div className="text-xs font-medium text-telegram-text">
                        {data[hoveredIndex].speed.toFixed(1)} км/ч
                    </div>
                    <div className="text-xs text-telegram-hint">
                        {formatTime(data[hoveredIndex].elapsedSeconds)}
                    </div>
                </div>
            )}
        </div>
    )
}

// Equipment Selector Component
interface EquipmentSelectorProps {
    selectedId: string
    onSelect: (id: string) => void
    isOpen: boolean
    onToggle: () => void
}

function EquipmentSelector({ selectedId, onSelect, isOpen, onToggle }: EquipmentSelectorProps) {
    const selected = EQUIPMENT_OPTIONS.find(e => e.id === selectedId) || EQUIPMENT_OPTIONS[0]

    return (
        <div className="relative">
            <button
                onClick={onToggle}
                className={cn(
                    "w-full flex items-center justify-between gap-3 p-4 rounded-2xl",
                    "bg-telegram-secondary-bg text-telegram-text",
                    "border-2 transition-all duration-200",
                    isOpen ? "border-primary" : "border-transparent hover:border-primary/30"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                        {selected.icon}
                    </div>
                    <div className="text-left">
                        <div className="text-sm text-telegram-hint">Оборудование</div>
                        <div className="font-medium">{selected.name}</div>
                    </div>
                </div>
                <ChevronDown className={cn(
                    "w-5 h-5 text-telegram-hint transition-transform duration-200",
                    isOpen && "rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-20">
                    <div className="bg-telegram-bg border border-border rounded-2xl shadow-xl overflow-hidden">
                        {EQUIPMENT_OPTIONS.map((equipment) => (
                            <button
                                key={equipment.id}
                                onClick={() => {
                                    onSelect(equipment.id)
                                    onToggle()
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 p-4 transition-colors",
                                    selectedId === equipment.id
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-telegram-secondary-bg text-telegram-text"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    selectedId === equipment.id
                                        ? "bg-primary/20 text-primary"
                                        : "bg-telegram-secondary-bg text-telegram-hint"
                                )}>
                                    {equipment.icon}
                                </div>
                                <span className="font-medium">{equipment.name}</span>
                                {selectedId === equipment.id && (
                                    <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// Session Timer Component
interface SessionTimerProps {
    elapsedSeconds: number
    isRunning: boolean
    onStart: () => void
    onPause: () => void
    onStop: () => void
}

function SessionTimer({ elapsedSeconds, isRunning, onStart, onPause, onStop }: SessionTimerProps) {
    return (
        <div className="flex flex-col items-center gap-4 py-6">
            {/* Timer Display */}
            <div className="relative">
                <div className={cn(
                    "text-6xl font-mono font-bold tabular-nums tracking-tight",
                    isRunning ? "text-primary" : "text-telegram-text"
                )}>
                    {formatTime(elapsedSeconds)}
                </div>
                <div className="text-center text-sm text-telegram-hint mt-1">
                    {isRunning ? 'В процессе' : elapsedSeconds > 0 ? 'Пауза' : 'Готов к старту'}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                {isRunning ? (
                    <>
                        <Button
                            variant="secondary"
                            size="lg"
                            leftIcon={<Pause className="w-5 h-5" />}
                            onClick={onPause}
                            haptic="light"
                        >
                            Пауза
                        </Button>
                        <Button
                            variant="emergency"
                            size="lg"
                            leftIcon={<Square className="w-5 h-5" />}
                            onClick={onStop}
                            haptic="medium"
                        >
                            Стоп
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="primary"
                        size="lg"
                        leftIcon={<Play className="w-5 h-5" />}
                        onClick={onStart}
                        haptic="medium"
                    >
                        {elapsedSeconds > 0 ? 'Продолжить' : 'Старт'}
                    </Button>
                )}
            </div>
        </div>
    )
}

// Parameter Stepper Component
interface ParameterStepperProps {
    label: string
    value: number
    step: number
    min: number
    max: number
    unit: string
    onChange: (value: number) => void
    quickAdjusts?: number[]
}

function ParameterStepper({
    label,
    value,
    step,
    min,
    max,
    unit,
    onChange,
    quickAdjusts = []
}: ParameterStepperProps) {
    const handleDecrement = () => onChange(Math.max(min, value - step))
    const handleIncrement = () => onChange(Math.min(max, value + step))

    return (
        <div className="bg-telegram-secondary-bg/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-telegram-hint">{label}</span>
                <span className="text-2xl font-bold text-telegram-text">
                    {value.toFixed(step < 1 ? 1 : 0)}
                    <span className="text-sm font-normal text-telegram-hint ml-1">{unit}</span>
                </span>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 mb-3">
                <button
                    onClick={handleDecrement}
                    disabled={value <= min}
                    className={cn(
                        "flex-1 flex items-center justify-center py-3 rounded-xl",
                        "bg-telegram-bg text-telegram-text",
                        "hover:bg-primary/10 hover:text-primary transition-colors",
                        "disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                >
                    <Minus className="w-5 h-5" />
                </button>
                <button
                    onClick={handleIncrement}
                    disabled={value >= max}
                    className={cn(
                        "flex-1 flex items-center justify-center py-3 rounded-xl",
                        "bg-telegram-bg text-telegram-text",
                        "hover:bg-primary/10 hover:text-primary transition-colors",
                        "disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Quick Adjust Chips */}
            {quickAdjusts.length > 0 && (
                <div className="flex items-center gap-2">
                    {quickAdjusts.map((adjust) => (
                        <button
                            key={adjust}
                            onClick={() => onChange(Math.min(max, Math.max(min, value + adjust)))}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-lg",
                                "bg-telegram-bg text-telegram-text",
                                "hover:bg-primary/10 hover:text-primary transition-colors"
                            )}
                        >
                            {adjust > 0 ? '+' : ''}{adjust}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// Timeline Notes Component
interface TimelineNotesProps {
    notes: TimelineNote[]
    elapsedSeconds: number
    onAddNote: (text: string) => void
    onDeleteNote: (id: string) => void
}

function TimelineNotes({ notes, elapsedSeconds, onAddNote, onDeleteNote }: TimelineNotesProps) {
    const [newNoteText, setNewNoteText] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    const handleAdd = () => {
        if (newNoteText.trim()) {
            onAddNote(newNoteText.trim())
            setNewNoteText('')
            setIsAdding(false)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-telegram-text">Заметки</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className={cn(
                        "flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg",
                        "transition-colors",
                        isAdding
                            ? "bg-danger/10 text-danger"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                >
                    {isAdding ? (
                        <><X className="w-4 h-4" /> Отмена</>
                    ) : (
                        <><Plus className="w-4 h-4" /> Добавить</>
                    )}
                </button>
            </div>

            {/* Add Note Input */}
            {isAdding && (
                <div className="flex items-center gap-2 p-3 bg-telegram-secondary-bg/50 rounded-xl">
                    <div className="text-sm font-mono text-telegram-hint">
                        {formatTime(elapsedSeconds)}
                    </div>
                    <input
                        type="text"
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="Введите заметку..."
                        className="flex-1 bg-transparent text-telegram-text placeholder:text-telegram-hint focus:outline-none"
                        autoFocus
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newNoteText.trim()}
                        className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                    >
                        Добавить
                    </button>
                </div>
            )}

            {/* Notes List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {notes.length === 0 ? (
                    <div className="text-center py-4 text-sm text-telegram-hint">
                        Нет заметок. Добавьте первую!
                    </div>
                ) : (
                    [...notes].reverse().map((note) => (
                        <div
                            key={note.id}
                            className="flex items-center gap-3 p-3 bg-telegram-secondary-bg/30 rounded-xl group"
                        >
                            <div className="text-sm font-mono text-primary font-medium">
                                {formatTime(note.elapsedSeconds)}
                            </div>
                            <div className="flex-1 text-sm text-telegram-text">
                                {note.text}
                            </div>
                            <button
                                onClick={() => onDeleteNote(note.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-telegram-hint hover:text-danger transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

// Helper function to format time
function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Main Component
export function WorkoutCardio() {
    const { hapticFeedback, showMainButton, hideMainButton } = useTelegram()
    const [backendWorkoutId, setBackendWorkoutId] = useState<number | null>(null)

    // Session state
    const [session, setSession] = useState<CardioSession>({
        id: `cardio_${Date.now()}`,
        equipmentId: 'treadmill',
        startedAt: new Date(),
        elapsedSeconds: 0,
        speed: 6.0,
        incline: 0,
        heartRate: undefined,
        notes: [],
        speedHistory: [],
        isActive: false,
    })

    // UI state
    const [isEquipmentOpen, setIsEquipmentOpen] = useState(false)
    const [showFinishConfirm, setShowFinishConfirm] = useState(false)

    // Timer ref
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastSpeedLogRef = useRef<number>(0)

    // Get current equipment
    const currentEquipment = EQUIPMENT_OPTIONS.find(e => e.id === session.equipmentId) || EQUIPMENT_OPTIONS[0]

    const ensureBackendSession = useCallback(async () => {
        if (backendWorkoutId) return backendWorkoutId
        try {
            const response = await workoutsApi.startWorkout({
                name: `Cardio - ${currentEquipment.name}`,
                type: 'cardio',
            })
            setBackendWorkoutId(response.id)
            return response.id
        } catch (error) {
            console.error('Failed to start cardio session on backend:', error)
            return null
        }
    }, [backendWorkoutId, currentEquipment.name])

    // Start timer
    const handleStart = useCallback(() => {
        void ensureBackendSession()
        setSession(prev => ({ ...prev, isActive: true }))
        hapticFeedback?.medium()

        timerRef.current = setInterval(() => {
            setSession(prev => {
                const newElapsed = prev.elapsedSeconds + 1

                // Log speed every 30 seconds
                let newSpeedHistory = prev.speedHistory
                if (newElapsed - lastSpeedLogRef.current >= 30) {
                    newSpeedHistory = [...prev.speedHistory, {
                        elapsedSeconds: newElapsed,
                        speed: prev.speed
                    }]
                    lastSpeedLogRef.current = newElapsed
                }

                return {
                    ...prev,
                    elapsedSeconds: newElapsed,
                    speedHistory: newSpeedHistory
                }
            })
        }, 1000)
    }, [hapticFeedback, ensureBackendSession])

    // Pause timer
    const handlePause = useCallback(() => {
        setSession(prev => ({ ...prev, isActive: false }))
        hapticFeedback?.light()

        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [hapticFeedback])

    // Stop timer (reset)
    const handleStop = useCallback(() => {
        setSession(prev => ({ ...prev, isActive: false, elapsedSeconds: 0 }))
        hapticFeedback?.heavy()

        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        lastSpeedLogRef.current = 0
    }, [hapticFeedback])

    // Update speed
    const handleSpeedChange = useCallback((newSpeed: number) => {
        setSession(prev => ({ ...prev, speed: newSpeed }))
        hapticFeedback?.light()
    }, [hapticFeedback])

    // Update incline
    const handleInclineChange = useCallback((newIncline: number) => {
        setSession(prev => ({ ...prev, incline: newIncline }))
        hapticFeedback?.light()
    }, [hapticFeedback])

    // Update heart rate
    const handleHeartRateChange = useCallback((value: string) => {
        const hr = value ? parseInt(value, 10) : undefined
        setSession(prev => ({ ...prev, heartRate: hr }))
    }, [])

    // Add timeline note
    const handleAddNote = useCallback((text: string) => {
        const newNote: TimelineNote = {
            id: `note_${Date.now()}`,
            timestamp: Date.now(),
            elapsedSeconds: session.elapsedSeconds,
            text
        }
        setSession(prev => ({
            ...prev,
            notes: [...prev.notes, newNote]
        }))
        hapticFeedback?.success()
    }, [session.elapsedSeconds, hapticFeedback])

    // Delete timeline note
    const handleDeleteNote = useCallback((noteId: string) => {
        setSession(prev => ({
            ...prev,
            notes: prev.notes.filter(n => n.id !== noteId)
        }))
    }, [])

    // Change equipment
    const handleEquipmentChange = useCallback((equipmentId: string) => {
        setSession(prev => ({ ...prev, equipmentId }))
        hapticFeedback?.selectionChanged?.()
    }, [hapticFeedback])

    // Finish workout
    const handleFinishWorkout = useCallback(() => {
        hapticFeedback?.success()

        // Save session data
        const sessionData = {
            ...session,
            endedAt: new Date().toISOString(),
            totalDuration: session.elapsedSeconds,
            avgSpeed: session.speedHistory.length > 0
                ? session.speedHistory.reduce((a, b) => a + b.speed, 0) / session.speedHistory.length
                : session.speed
        }

        localStorage.setItem(`cardio_session_${session.id}`, JSON.stringify(sessionData))

        const durationMinutes = Math.max(1, Math.round(session.elapsedSeconds / 60))
        const completionPayload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: [
                {
                    exercise_id: 1,
                    name: currentEquipment.name,
                    sets_completed: [
                        {
                            set_number: 1,
                            duration: session.elapsedSeconds,
                            completed: true,
                        },
                    ],
                    notes: session.notes.map((note) => `${formatTime(note.elapsedSeconds)} ${note.text}`).join(' | ') || undefined,
                },
            ],
            comments: `Avg speed ${stats.avgSpeed.toFixed(1)} km/h, HR ${session.heartRate || 'n/a'}`,
            tags: ['cardio', session.equipmentId],
        }

        if (backendWorkoutId) {
            void workoutsApi.completeWorkout(backendWorkoutId, completionPayload).catch((error) => {
                console.error('Failed to complete cardio workout on backend:', error)
            })
        }

        // Navigate back
        window.history.back()
    }, [session, hapticFeedback, currentEquipment.name, stats.avgSpeed, backendWorkoutId])

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [])

    // Telegram Main Button
    useEffect(() => {
        if (session.elapsedSeconds > 0) {
            showMainButton('Завершить тренировку', () => setShowFinishConfirm(true))
        } else {
            hideMainButton()
        }

        return () => {
            hideMainButton()
        }
    }, [session.elapsedSeconds, showMainButton, hideMainButton])

    // Calculate stats
    const stats = useMemo(() => {
        const avgSpeed = session.speedHistory.length > 0
            ? session.speedHistory.reduce((a, b) => a + b.speed, 0) / session.speedHistory.length
            : session.speed

        // Estimate calories (simplified formula)
        const calories = Math.round(session.elapsedSeconds * (avgSpeed * 0.15))

        return { avgSpeed, calories }
    }, [session.speedHistory, session.speed, session.elapsedSeconds])

    return (
        <div className="min-h-screen bg-telegram-bg pb-32">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border safe-area-top">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-telegram-text">Кардио тренировка</h1>
                            <div className="flex items-center gap-2 text-sm text-telegram-hint">
                                <Clock className="w-4 h-4" />
                                <span>{formatTime(session.elapsedSeconds)}</span>
                                {session.isActive && (
                                    <span className="flex items-center gap-1 text-success">
                                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                        Активна
                                    </span>
                                )}
                            </div>
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

            <div className="p-4 space-y-4">
                {/* Equipment Selector */}
                <EquipmentSelector
                    selectedId={session.equipmentId}
                    onSelect={handleEquipmentChange}
                    isOpen={isEquipmentOpen}
                    onToggle={() => setIsEquipmentOpen(!isEquipmentOpen)}
                />

                {/* Session Timer */}
                <div className="bg-telegram-secondary-bg/30 rounded-2xl p-4">
                    <SessionTimer
                        elapsedSeconds={session.elapsedSeconds}
                        isRunning={session.isActive}
                        onStart={handleStart}
                        onPause={handlePause}
                        onStop={handleStop}
                    />
                </div>

                {/* Parameters Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Speed */}
                    <ParameterStepper
                        label="Скорость"
                        value={session.speed}
                        step={0.5}
                        min={0}
                        max={25}
                        unit="км/ч"
                        onChange={handleSpeedChange}
                        quickAdjusts={[-1, -0.5, 0.5, 1]}
                    />

                    {/* Incline (if applicable) */}
                    {currentEquipment.hasIncline && (
                        <ParameterStepper
                            label="Наклон"
                            value={session.incline}
                            step={0.5}
                            min={0}
                            max={15}
                            unit="%"
                            onChange={handleInclineChange}
                            quickAdjusts={[-2, -1, 1, 2]}
                        />
                    )}
                </div>

                {/* Heart Rate Input */}
                <div className="bg-telegram-secondary-bg/50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-danger/20 text-danger flex items-center justify-center">
                            <Heart className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm text-telegram-hint block mb-1">Пульс</label>
                            <Input
                                type="number"
                                placeholder="Введите пульс"
                                value={session.heartRate || ''}
                                onChange={(e) => handleHeartRateChange(e.target.value)}
                                className="bg-telegram-bg"
                            />
                        </div>
                        <span className="text-sm text-telegram-hint">уд/мин</span>
                    </div>
                </div>

                {/* Mini Chart */}
                {session.speedHistory.length > 0 && (
                    <div className="bg-telegram-secondary-bg/30 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                <h3 className="font-medium text-telegram-text">График скорости</h3>
                            </div>
                            <div className="text-sm text-telegram-hint">
                                Средн: {stats.avgSpeed.toFixed(1)} км/ч
                            </div>
                        </div>
                        <Sparkline
                            data={session.speedHistory}
                            width={typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 400) : 300}
                            height={100}
                        />
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-telegram-secondary-bg/30 rounded-2xl p-4 text-center">
                        <div className="text-2xl font-bold text-telegram-text">
                            {stats.calories}
                        </div>
                        <div className="text-sm text-telegram-hint">ккал (прибл.)</div>
                    </div>
                    <div className="bg-telegram-secondary-bg/30 rounded-2xl p-4 text-center">
                        <div className="text-2xl font-bold text-telegram-text">
                            {session.heartRate || '--'}
                        </div>
                        <div className="text-sm text-telegram-hint">пульс</div>
                    </div>
                </div>

                {/* Timeline Notes */}
                <div className="bg-telegram-secondary-bg/30 rounded-2xl p-4">
                    <TimelineNotes
                        notes={session.notes}
                        elapsedSeconds={session.elapsedSeconds}
                        onAddNote={handleAddNote}
                        onDeleteNote={handleDeleteNote}
                    />
                </div>
            </div>

            {/* Sticky Bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-telegram-bg border-t border-border safe-area-bottom p-4 z-20">
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    leftIcon={<Flag className="w-5 h-5" />}
                    onClick={() => setShowFinishConfirm(true)}
                    disabled={session.elapsedSeconds === 0}
                    haptic="medium"
                >
                    {session.elapsedSeconds === 0
                        ? 'Начните тренировку'
                        : `Завершить сессию (${formatTime(session.elapsedSeconds)})`
                    }
                </Button>
            </div>

            {/* Finish Confirmation Modal */}
            {showFinishConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-telegram-bg rounded-2xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold text-telegram-text mb-2">
                            Завершить тренировку?
                        </h3>
                        <p className="text-sm text-telegram-hint mb-6">
                            Длительность: {formatTime(session.elapsedSeconds)}
                            <br />
                            Средняя скорость: {stats.avgSpeed.toFixed(1)} км/ч
                            <br />
                            Примерно сожжено: {stats.calories} ккал
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                fullWidth
                                onClick={() => setShowFinishConfirm(false)}
                            >
                                Отмена
                            </Button>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={handleFinishWorkout}
                            >
                                Завершить
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default WorkoutCardio
