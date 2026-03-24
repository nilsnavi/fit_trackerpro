import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    Dumbbell,
    Flag,
    Play,
    SkipForward,
    Timer,
    X
} from 'lucide-react'
import { useTelegram } from '@hooks/useTelegram'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { ProgressBar } from '@components/ui/ProgressBar'
import { workoutsApi } from '@services/workouts'
import type { WorkoutCompleteRequest } from '@/types/workouts'

// Типы
interface ExerciseSet {
    setNumber: number
    targetWeight: number
    targetReps: number
    actualWeight?: number
    actualReps?: number
    completed: boolean
}

interface Exercise {
    id: string
    name: string
    muscleGroup: string
    sets: ExerciseSet[]
    restSeconds: number
    skipped: boolean
}

interface WorkoutSession {
    id: string
    name: string
    startedAt: Date
    exercises: Exercise[]
}

interface SetInput {
    weight: string
    reps: string
}

// Тестовые данные тренировки
const mockWorkout: WorkoutSession = {
    id: '1',
    name: 'Upper Body Strength',
    startedAt: new Date(),
    exercises: [
        {
            id: '1',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            restSeconds: 90,
            skipped: false,
            sets: [
                { setNumber: 1, targetWeight: 60, targetReps: 10, completed: false },
                { setNumber: 2, targetWeight: 65, targetReps: 8, completed: false },
                { setNumber: 3, targetWeight: 70, targetReps: 6, completed: false },
                { setNumber: 4, targetWeight: 70, targetReps: 6, completed: false },
            ]
        },
        {
            id: '2',
            name: 'Bent Over Row',
            muscleGroup: 'Back',
            restSeconds: 90,
            skipped: false,
            sets: [
                { setNumber: 1, targetWeight: 50, targetReps: 10, completed: false },
                { setNumber: 2, targetWeight: 55, targetReps: 8, completed: false },
                { setNumber: 3, targetWeight: 60, targetReps: 8, completed: false },
            ]
        },
        {
            id: '3',
            name: 'Overhead Press',
            muscleGroup: 'Shoulders',
            restSeconds: 60,
            skipped: false,
            sets: [
                { setNumber: 1, targetWeight: 35, targetReps: 10, completed: false },
                { setNumber: 2, targetWeight: 40, targetReps: 8, completed: false },
                { setNumber: 3, targetWeight: 40, targetReps: 8, completed: false },
            ]
        },
        {
            id: '4',
            name: 'Barbell Curl',
            muscleGroup: 'Biceps',
            restSeconds: 60,
            skipped: false,
            sets: [
                { setNumber: 1, targetWeight: 25, targetReps: 12, completed: false },
                { setNumber: 2, targetWeight: 30, targetReps: 10, completed: false },
                { setNumber: 3, targetWeight: 30, targetReps: 10, completed: false },
            ]
        },
    ]
}

// Компонент модального окна таймера отдыха
interface RestTimerModalProps {
    isOpen: boolean
    onClose: () => void
    duration: number
    onComplete: () => void
}

function RestTimerModal({ isOpen, onClose, duration, onComplete }: RestTimerModalProps) {
    const [timeLeft, setTimeLeft] = useState(duration)
    const [isRunning, setIsRunning] = useState(true)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const { hapticFeedback } = useTelegram()

    useEffect(() => {
        if (isOpen) {
            setTimeLeft(duration)
            setIsRunning(true)
        }
    }, [isOpen, duration])

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        hapticFeedback?.success()
                        onComplete()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isRunning, timeLeft, hapticFeedback, onComplete])

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const progress = ((duration - timeLeft) / duration) * 100

    const quickAddTimes = [15, 30, 60]

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Rest Timer" size="sm">
            <div className="flex flex-col items-center gap-6 py-4">
                {/* Timer Display */}
                <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-telegram-secondary-bg"
                        />
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 45}`}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                            className={`transition-all duration-1000 ease-linear ${timeLeft === 0 ? 'text-success' : 'text-primary'}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl font-mono font-bold tabular-nums ${timeLeft === 0 ? 'text-success' : 'text-telegram-text'}`}>
                            {formatTime(timeLeft)}
                        </span>
                        {timeLeft === 0 && (
                            <span className="text-sm text-success font-medium mt-1">Done!</span>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-telegram-secondary-bg rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft === 0 ? 'bg-success' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setTimeLeft(prev => Math.max(0, prev - 10))}
                    >
                        -10s
                    </Button>
                    <Button
                        variant={isRunning ? "secondary" : "primary"}
                        size="md"
                        leftIcon={isRunning ? <span className="text-lg">⏸</span> : <Play className="w-4 h-4" />}
                        onClick={() => setIsRunning(!isRunning)}
                    >
                        {isRunning ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setTimeLeft(prev => prev + 10)}
                    >
                        +10s
                    </Button>
                </div>

                {/* Quick Add Times */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-telegram-hint">Add:</span>
                    {quickAddTimes.map((seconds) => (
                        <button
                            key={seconds}
                            onClick={() => setTimeLeft(prev => prev + seconds)}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-telegram-secondary-bg text-telegram-text hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            +{seconds}s
                        </button>
                    ))}
                </div>

                {/* Close Button */}
                <Button variant="ghost" fullWidth onClick={onClose}>
                    Skip Rest
                </Button>
            </div>
        </Modal>
    )
}

// Компонент карточки упражнения
interface ExerciseCardProps {
    exercise: Exercise
    isActive: boolean
    isCompleted: boolean
    currentSetIndex: number
    onToggleExpand: () => void
    onSkip: () => void
    onLogSet: (setIndex: number, weight: number, reps: number) => void
    onStartRest: () => void
    expanded: boolean
}

function ExerciseCard({
    exercise,
    isActive,
    isCompleted,
    currentSetIndex,
    onToggleExpand,
    onSkip,
    onLogSet,
    onStartRest,
    expanded
}: ExerciseCardProps) {
    const [setInputs, setSetInputs] = useState<Record<number, SetInput>>({})
    const { hapticFeedback } = useTelegram()

    const completedSets = exercise.sets.filter(s => s.completed).length
    const totalSets = exercise.sets.length

    const handleLogSet = (setIndex: number) => {
        const input = setInputs[setIndex]
        if (!input?.weight || !input?.reps) return

        const weight = parseFloat(input.weight)
        const reps = parseInt(input.reps)

        if (isNaN(weight) || isNaN(reps)) return

        onLogSet(setIndex, weight, reps)
        hapticFeedback?.medium()

        // Очистка ввода после записи
        setSetInputs(prev => ({ ...prev, [setIndex]: { weight: '', reps: '' } }))

        // Запуск отдыха, если не последний подход
        if (setIndex < exercise.sets.length - 1) {
            onStartRest()
        }
    }

    if (exercise.skipped) {
        return (
            <div className="bg-telegram-secondary-bg/50 rounded-2xl p-4 opacity-60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center">
                            <SkipForward className="w-5 h-5 text-neutral-500" />
                        </div>
                        <div>
                            <h3 className="font-medium text-telegram-text line-through">{exercise.name}</h3>
                            <p className="text-sm text-telegram-hint">{exercise.muscleGroup} • Skipped</p>
                        </div>
                    </div>
                    <span className="text-sm text-telegram-hint">Skipped</span>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`rounded-2xl border-2 transition-all duration-200 ${isActive
                ? 'bg-telegram-bg border-primary shadow-lg'
                : isCompleted
                    ? 'bg-telegram-secondary-bg/50 border-transparent opacity-70'
                    : 'bg-telegram-bg border-border'
                }`}
        >
            {/* Header */}
            <button
                onClick={onToggleExpand}
                className="w-full p-4 flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCompleted
                        ? 'bg-success/20 text-success'
                        : isActive
                            ? 'bg-primary/20 text-primary'
                            : 'bg-telegram-secondary-bg text-telegram-hint'
                        }`}>
                        {isCompleted ? (
                            <Check className="w-5 h-5" />
                        ) : (
                            <Dumbbell className="w-5 h-5" />
                        )}
                    </div>
                    <div className="text-left">
                        <h3 className={`font-medium ${isCompleted ? 'line-through text-telegram-hint' : 'text-telegram-text'}`}>
                            {exercise.name}
                        </h3>
                        <p className="text-sm text-telegram-hint">{exercise.muscleGroup}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-telegram-hint">
                        {completedSets}/{totalSets}
                    </span>
                    {expanded ? (
                        <ChevronUp className="w-5 h-5 text-telegram-hint" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-telegram-hint" />
                    )}
                </div>
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Skip Checkbox */}
                    {!isCompleted && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={exercise.skipped}
                                onChange={onSkip}
                                className="w-4 h-4 rounded border-telegram-hint text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-telegram-hint">Skip this exercise</span>
                        </label>
                    )}

                    {/* Sets */}
                    <div className="space-y-2">
                        {exercise.sets.map((set, index) => {
                            const isCurrentSet = isActive && index === currentSetIndex && !set.completed
                            const input = setInputs[index] || { weight: '', reps: '' }

                            return (
                                <div
                                    key={set.setNumber}
                                    className={`p-3 rounded-xl transition-all ${set.completed
                                        ? 'bg-success/10 border border-success/30'
                                        : isCurrentSet
                                            ? 'bg-primary/5 border border-primary/30'
                                            : 'bg-telegram-secondary-bg'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-sm font-medium ${set.completed ? 'text-success' : isCurrentSet ? 'text-primary' : 'text-telegram-text'
                                            }`}>
                                            Set {set.setNumber}
                                        </span>
                                        {set.completed && (
                                            <Check className="w-4 h-4 text-success" />
                                        )}
                                    </div>

                                    {/* Target */}
                                    <div className="flex items-center gap-4 text-sm text-telegram-hint mb-3">
                                        <span>Target: {set.targetWeight}kg × {set.targetReps}</span>
                                    </div>

                                    {/* Actual or Input */}
                                    {set.completed ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-telegram-text font-medium">
                                                Done: {set.actualWeight}kg × {set.actualReps}
                                            </span>
                                        </div>
                                    ) : isCurrentSet ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <Input
                                                    type="number"
                                                    placeholder={`${set.targetWeight}`}
                                                    value={input.weight}
                                                    onChange={(e) => setSetInputs(prev => ({
                                                        ...prev,
                                                        [index]: { ...input, weight: e.target.value }
                                                    }))}
                                                    className="text-center"
                                                />
                                                <span className="text-xs text-telegram-hint text-center block mt-1">kg</span>
                                            </div>
                                            <span className="text-telegram-hint">×</span>
                                            <div className="flex-1">
                                                <Input
                                                    type="number"
                                                    placeholder={`${set.targetReps}`}
                                                    value={input.reps}
                                                    onChange={(e) => setSetInputs(prev => ({
                                                        ...prev,
                                                        [index]: { ...input, reps: e.target.value }
                                                    }))}
                                                    className="text-center"
                                                />
                                                <span className="text-xs text-telegram-hint text-center block mt-1">reps</span>
                                            </div>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleLogSet(index)}
                                                disabled={!input.weight || !input.reps}
                                            >
                                                Log
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-telegram-hint">
                                            Waiting...
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// Главный компонент
export function WorkoutStrength() {
    const { hapticFeedback, showMainButton, hideMainButton } = useTelegram()
    const [workout, setWorkout] = useState<WorkoutSession>(mockWorkout)
    const [backendWorkoutId, setBackendWorkoutId] = useState<number | null>(null)
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
    const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set(['1']))
    const [isRestTimerOpen, setIsRestTimerOpen] = useState(false)
    const [restDuration, setRestDuration] = useState(90)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    const [pendingSync, setPendingSync] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Расчет прогресса
    const totalExercises = workout.exercises.length
    const completedExercises = workout.exercises.filter(e =>
        e.sets.every(s => s.completed) || e.skipped
    ).length

    // Таймер прошедшего времени
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1)
        }, 1000)

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [])

    // Создаем сессию на backend для корректного complete-контракта
    useEffect(() => {
        let isCancelled = false

        const createSession = async () => {
            try {
                const response = await workoutsApi.startWorkout({
                    name: workout.name,
                    type: 'strength',
                })
                if (!isCancelled) {
                    setBackendWorkoutId(response.id)
                }
            } catch (error) {
                console.error('Failed to start workout session:', error)
            }
        }

        createSession()

        return () => {
            isCancelled = true
        }
    }, [workout.name])

    // Форматирование прошедшего времени
    const formatElapsedTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Определение онлайн/офлайн статуса
    useEffect(() => {
        const handleOnline = () => setIsOffline(false)
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Синхронизация при возвращении онлайн
    useEffect(() => {
        if (!isOffline && pendingSync) {
            syncWorkoutProgress()
        }
    }, [isOffline, pendingSync])

    // Главная кнопка Telegram
    useEffect(() => {
        if (completedExercises > 0) {
            showMainButton('Finish Workout', handleFinishWorkout)
        } else {
            hideMainButton()
        }

        return () => {
            hideMainButton()
        }
    }, [completedExercises])

    // Автоматическое раскрытие текущего упражнения
    useEffect(() => {
        const currentExercise = workout.exercises[currentExerciseIndex]
        if (currentExercise && !currentExercise.skipped) {
            setExpandedExercises(prev => new Set([...prev, currentExercise.id]))
        }
    }, [currentExerciseIndex, workout.exercises])

    const toggleExerciseExpand = (exerciseId: string) => {
        setExpandedExercises(prev => {
            const newSet = new Set(prev)
            if (newSet.has(exerciseId)) {
                newSet.delete(exerciseId)
            } else {
                newSet.add(exerciseId)
            }
            return newSet
        })
    }

    const handleSkipExercise = (exerciseIndex: number) => {
        setWorkout(prev => {
            const newExercises = [...prev.exercises]
            newExercises[exerciseIndex] = {
                ...newExercises[exerciseIndex],
                skipped: !newExercises[exerciseIndex].skipped
            }
            return { ...prev, exercises: newExercises }
        })
        hapticFeedback?.light()
        saveProgress()
    }

    const handleLogSet = (exerciseIndex: number, setIndex: number, weight: number, reps: number) => {
        setWorkout(prev => {
            const newExercises = [...prev.exercises]
            const exercise = newExercises[exerciseIndex]
            const newSets = [...exercise.sets]
            newSets[setIndex] = {
                ...newSets[setIndex],
                actualWeight: weight,
                actualReps: reps,
                completed: true
            }
            newExercises[exerciseIndex] = { ...exercise, sets: newSets }
            return { ...prev, exercises: newExercises }
        })

        // Переход к следующему упражнению, если все подходы выполнены
        const exercise = workout.exercises[exerciseIndex]
        const allSetsCompleted = exercise.sets.every((s, idx) =>
            idx === setIndex ? true : s.completed
        )

        if (allSetsCompleted) {
            const nextExerciseIndex = workout.exercises.findIndex((e, idx) =>
                idx > exerciseIndex && !e.skipped && !e.sets.every(s => s.completed)
            )
            if (nextExerciseIndex !== -1) {
                setCurrentExerciseIndex(nextExerciseIndex)
            }
        }

        saveProgress()
    }

    const handleStartRest = (duration?: number) => {
        setRestDuration(duration || workout.exercises[currentExerciseIndex]?.restSeconds || 90)
        setIsRestTimerOpen(true)
        hapticFeedback?.medium()
    }

    const handleRestComplete = () => {
        hapticFeedback?.success()
    }

    const saveProgress = useCallback(async () => {
        const saveData = {
            workoutId: workout.id,
            exercises: workout.exercises,
            elapsedTime,
            timestamp: new Date().toISOString()
        }

        // Прогресс сохраняется локально до завершения тренировки.
        localStorage.setItem(`workout_progress_${workout.id}`, JSON.stringify(saveData))
    }, [workout, elapsedTime])

    const syncWorkoutProgress = async () => {
        if (!pendingSync) return

        // Backend currently syncs on complete only.
        setPendingSync(false)
    }

    const handleFinishWorkout = async () => {
        hapticFeedback?.success()

        const durationMinutes = Math.max(1, Math.round(elapsedTime / 60))
        const exercisesPayload = workout.exercises
            .filter((exercise) => !exercise.skipped)
            .map((exercise, index) => ({
                exercise_id: Number.parseInt(exercise.id, 10) || index + 1,
                name: exercise.name,
                sets_completed: exercise.sets.map((set) => ({
                    set_number: set.setNumber,
                    reps: set.actualReps ?? set.targetReps,
                    weight: set.actualWeight ?? set.targetWeight,
                    completed: set.completed,
                })),
                notes: exercise.skipped ? 'Skipped' : undefined,
            }))

        const finishData = {
            workoutId: workout.id,
            exercises: workout.exercises,
            elapsedTime,
            completedAt: new Date().toISOString(),
        }

        const completionPayload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: exercisesPayload,
            comments: `Completed in ${durationMinutes} min`,
            tags: ['strength'],
        }

        // Save to localStorage
        localStorage.setItem(`workout_completed_${workout.id}`, JSON.stringify(finishData))
        localStorage.removeItem(`workout_progress_${workout.id}`)

        if (!isOffline && backendWorkoutId && completionPayload.exercises.length > 0) {
            try {
                await workoutsApi.completeWorkout(backendWorkoutId, completionPayload)
            } catch (error) {
                console.error('Failed to complete workout:', error)
            }
        }

        // Navigate back or show completion screen
        window.history.back()
    }

    const getCurrentSetIndex = (exercise: Exercise): number => {
        return exercise.sets.findIndex(s => !s.completed)
    }

    return (
        <div className="min-h-screen bg-telegram-bg pb-32">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border safe-area-top">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-xl font-bold text-telegram-text">{workout.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-telegram-hint">
                                <Clock className="w-4 h-4" />
                                <span>{formatElapsedTime(elapsedTime)}</span>
                                {isOffline && (
                                    <span className="text-warning text-xs">• Offline</span>
                                )}
                                {pendingSync && !isOffline && (
                                    <span className="text-warning text-xs">• Syncing...</span>
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

                    {/* Progress Bar */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <ProgressBar
                                value={completedExercises}
                                max={totalExercises}
                                showLabel
                                labelFormat="fraction"
                                size="sm"
                                color="gradient"
                                animated
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Exercise List */}
            <div className="p-4 space-y-3">
                {workout.exercises.map((exercise, index) => (
                    <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        isActive={index === currentExerciseIndex && !exercise.skipped}
                        isCompleted={exercise.sets.every(s => s.completed) || exercise.skipped}
                        currentSetIndex={getCurrentSetIndex(exercise)}
                        expanded={expandedExercises.has(exercise.id)}
                        onToggleExpand={() => toggleExerciseExpand(exercise.id)}
                        onSkip={() => handleSkipExercise(index)}
                        onLogSet={(setIndex, weight, reps) => handleLogSet(index, setIndex, weight, reps)}
                        onStartRest={() => handleStartRest()}
                    />
                ))}
            </div>

            {/* Quick Rest Timer Buttons */}
            <div className="px-4 py-3 bg-telegram-secondary-bg/50 border-t border-border">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-telegram-text">Quick Rest:</span>
                    <div className="flex items-center gap-2">
                        {[60, 90, 120].map((seconds) => (
                            <button
                                key={seconds}
                                onClick={() => handleStartRest(seconds)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-telegram-bg text-telegram-text border border-border hover:border-primary hover:text-primary transition-colors"
                            >
                                <Timer className="w-3 h-3" />
                                {seconds}s
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky Bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-telegram-bg border-t border-border safe-area-bottom p-4 z-20">
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    leftIcon={<Flag className="w-5 h-5" />}
                    onClick={handleFinishWorkout}
                    disabled={completedExercises === 0}
                    haptic="medium"
                >
                    {completedExercises === 0
                        ? 'Complete at least 1 exercise'
                        : `Finish Workout (${completedExercises}/${totalExercises})`
                    }
                </Button>
            </div>

            {/* Rest Timer Modal */}
            <RestTimerModal
                isOpen={isRestTimerOpen}
                onClose={() => setIsRestTimerOpen(false)}
                duration={restDuration}
                onComplete={handleRestComplete}
            />
        </div>
    )
}

export default WorkoutStrength
