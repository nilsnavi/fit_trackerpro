import { memo, useState, useEffect } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Settings, X, Zap } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { useActiveWorkoutActions, useActiveWorkoutStore, useRestDurationForExercise } from '@/state/local'
import { useRestTimer } from '@features/workouts/active/hooks/useRestTimer'
import { RestTimerSettingsModal } from './RestTimerSettingsModal'

export const RestTimerPanel = memo(function RestTimerPanel({
    onSkipWithAnalytics,
    onStopWithAnalytics,
}: {
    onSkipWithAnalytics?: () => void
    onStopWithAnalytics?: () => void
} = {}) {
    const restTimer = useActiveWorkoutStore((s) => s.restTimer)
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const autoAdvanceSettings = useActiveWorkoutStore((s) => s.autoAdvanceSettings)
    const currentExerciseIndex = useActiveWorkoutStore((s) => s.currentExerciseIndex)
    const currentSetIndex = useActiveWorkoutStore((s) => s.currentSetIndex)
    const exercises = useActiveWorkoutStore((s) => s.exercises)
    const {
        tickRestTimer,
        pauseRestTimer,
        resumeRestTimer,
        restartRestTimer,
        skipRestTimer,
        setCurrentPosition,
    } = useActiveWorkoutActions()

    const [showSettings, setShowSettings] = useState(false)
    const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null)

    // Get current exercise ID for adaptive rest
    const currentExerciseId = exercises?.[currentExerciseIndex]?.exercise_id
    const adaptiveRestSeconds = useRestDurationForExercise(currentExerciseId ?? 0)
    
    // Calculate next position for auto-advance
    const getNextPosition = () => {
        if (!exercises || exercises.length === 0) return null
        
        let nextExerciseIndex = currentExerciseIndex
        let nextSetIndex = currentSetIndex + 1
        
        // Check if there are more sets in current exercise
        if (nextSetIndex < exercises[nextExerciseIndex].sets_completed.length) {
            return { exerciseIndex: nextExerciseIndex, setIndex: nextSetIndex }
        }
        
        // Move to next exercise
        nextExerciseIndex++
        if (nextExerciseIndex < exercises.length) {
            return { exerciseIndex: nextExerciseIndex, setIndex: 0 }
        }
        
        // No more exercises
        return null
    }

    const handleAutoAdvance = () => {
        const nextPos = getNextPosition()
        if (nextPos) {
            setCurrentPosition(nextPos.exerciseIndex, nextPos.setIndex)
            setAutoAdvanceCountdown(null)
        }
    }

    const { formatRestTime, progressPercentage } = useRestTimer({
        isRunning: restTimer.isRunning,
        isPaused: restTimer.isPaused,
        remainingSeconds: restTimer.remainingSeconds,
        durationSeconds: restTimer.durationSeconds,
        tick: tickRestTimer,
        onComplete: () => {
            console.log('Rest timer completed')
            // Start countdown if auto-advance is enabled
            if (autoAdvanceSettings.enabled && autoAdvanceSettings.requireConfirmation) {
                setAutoAdvanceCountdown(autoAdvanceSettings.countdownSeconds)
            } else if (autoAdvanceSettings.enabled) {
                handleAutoAdvance()
            }
        },
        onAutoAdvance: handleAutoAdvance,
        soundEnabled: true,
        vibrationEnabled: true,
        autoAdvanceEnabled: autoAdvanceSettings.enabled,
        autoAdvanceCountdown: autoAdvanceSettings.countdownSeconds,
        requireConfirmation: autoAdvanceSettings.requireConfirmation,
    })

    // Countdown effect for UI display
    useEffect(() => {
        if (autoAdvanceCountdown === null) return
        
        if (autoAdvanceCountdown <= 0) {
            handleAutoAdvance()
            return
        }
        
        const timer = window.setTimeout(() => {
            setAutoAdvanceCountdown(autoAdvanceCountdown - 1)
        }, 1000)
        
        return () => clearTimeout(timer)
    }, [autoAdvanceCountdown])

    // Cancel auto-advance when user interacts
    const handleCancelAutoAdvance = () => {
        setAutoAdvanceCountdown(null)
    }
    
    // Show indicator if using adaptive rest
    const isUsingAdaptiveRest = currentExerciseId && adaptiveRestSeconds !== restDefaultSeconds

    if (!restTimer.isRunning && !restTimer.isPaused) {
        return null
    }

    return (
        <>
            <div className="rounded-xl border border-border bg-gradient-to-br from-telegram-secondary-bg to-telegram-bg p-4 space-y-3 shadow-lg">
                {/* Auto-Advance Countdown Overlay */}
                {autoAdvanceCountdown !== null && autoAdvanceCountdown > 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl animate-in fade-in duration-200">
                        <div className="text-center">
                            <p className="text-white text-lg font-semibold mb-2">Автопереход</p>
                            <div className="text-6xl font-bold text-yellow-400 animate-pulse tabular-nums">
                                {autoAdvanceCountdown}
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelAutoAdvance}
                                className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors flex items-center gap-2 mx-auto"
                            >
                                <X className="h-4 w-4" />
                                Отмена
                            </button>
                        </div>
                    </div>
                )}

                {/* Timer Display with Progress */}
                <div className="relative">
                    {/* Circular Progress Background */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                className="text-telegram-text"
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
                                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercentage / 100)}`}
                                className={`transition-all duration-1000 ease-linear ${
                                    restTimer.remainingSeconds <= 3 ? 'text-red-500 animate-pulse' : 'text-blue-500'
                                }`}
                                transform="rotate(-90 50 50)"
                            />
                        </svg>
                    </div>

                    {/* Timer Content */}
                    <div className="relative flex items-center justify-between gap-2 py-2">
                        <div className="flex-1">
                            <p className="text-xs text-telegram-hint font-medium uppercase tracking-wide">Отдых</p>
                            <p 
                                className={`text-3xl font-bold tabular-nums transition-colors duration-300 ${
                                    restTimer.remainingSeconds <= 3 
                                        ? 'text-red-500 animate-pulse' 
                                        : 'text-telegram-text'
                                }`}
                            >
                                {formatRestTime(restTimer.remainingSeconds)}
                            </p>
                            {restTimer.remainingSeconds <= 3 && restTimer.remainingSeconds > 0 && (
                                <p className="text-xs text-red-500 font-semibold mt-1 animate-bounce">
                                    Готовьтесь!
                                </p>
                            )}
                            {autoAdvanceSettings.enabled && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    Автопереход включен
                                </p>
                            )}
                            {isUsingAdaptiveRest && (
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                                    <Settings className="h-3 w-3" />
                                    Персональное: {adaptiveRestSeconds}с
                                </p>
                            )}
                        </div>
                        
                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-1">
                            <span 
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    restTimer.isPaused 
                                        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' 
                                        : 'bg-green-500/20 text-green-600 dark:text-green-400'
                                }`}
                            >
                                {restTimer.isPaused ? 'Пауза' : 'Идёт'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowSettings(true)}
                                className="text-xs text-telegram-hint hover:text-telegram-link transition-colors flex items-center gap-1"
                                aria-label="Настройки таймера"
                            >
                                <Settings className="h-3 w-3" />
                                Настройки
                            </button>
                        </div>
                    </div>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-2">
                    {restTimer.isPaused ? (
                        <Button 
                            type="button" 
                            variant="primary" 
                            size="md" 
                            leftIcon={<Play className="h-4 w-4" />} 
                            onClick={resumeRestTimer}
                            className="flex-1 min-w-[100px]"
                        >
                            Продолжить
                        </Button>
                    ) : (
                        <Button 
                            type="button" 
                            variant="secondary" 
                            size="md" 
                            leftIcon={<Pause className="h-4 w-4" />} 
                            onClick={pauseRestTimer}
                            className="flex-1 min-w-[100px]"
                        >
                            Пауза
                        </Button>
                    )}
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        leftIcon={<RotateCcw className="h-4 w-4" />} 
                        onClick={restartRestTimer}
                        title="Сбросить таймер"
                    >
                        Сброс
                    </Button>
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        leftIcon={<SkipForward className="h-4 w-4" />} 
                        onClick={onSkipWithAnalytics || skipRestTimer}
                        title="Пропустить отдых"
                        className="text-orange-600 hover:text-orange-700 dark:text-orange-400"
                    >
                        Пропустить
                    </Button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {[60, 90, 120, 180].map((seconds) => (
                        <button
                            key={seconds}
                            type="button"
                            onClick={() => restartRestTimer()}
                            disabled={!restTimer.isPaused && restTimer.isRunning}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                                restTimer.durationSeconds === seconds
                                    ? 'bg-blue-500 text-white font-medium'
                                    : 'bg-telegram-bg hover:bg-telegram-secondary-bg text-telegram-hint'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-label={`Установить ${seconds} секунд`}
                        >
                            {seconds >= 60 ? `${seconds / 60}м` : `${seconds}с`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Settings Modal */}
            <RestTimerSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                defaultSeconds={restDefaultSeconds}
            />
        </>
    )
})

RestTimerPanel.displayName = 'RestTimerPanel'
