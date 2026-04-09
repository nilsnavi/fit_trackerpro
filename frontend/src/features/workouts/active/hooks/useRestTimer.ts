import { useEffect, useMemo, useRef } from 'react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

interface UseRestTimerParams {
    isRunning: boolean
    isPaused: boolean
    remainingSeconds: number
    durationSeconds: number
    tick: () => void
    onComplete?: () => void
    soundEnabled?: boolean
    vibrationEnabled?: boolean
}

/**
 * Creates an audio context for playing timer completion sounds.
 * Uses Web Audio API for reliable sound generation without external files.
 */
function createCompletionSound(): void {
    try {
        const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioCtx) return
        const audioContext = new AudioCtx()
        
        // Create oscillator for beep sound
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        // Configure sound: pleasant double-beep pattern
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
        oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1) // C#6
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
        
        // Play sound
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.4)
        
        // Second beep after short pause
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator()
            const gainNode2 = audioContext.createGain()
            
            oscillator2.connect(gainNode2)
            gainNode2.connect(audioContext.destination)
            
            oscillator2.type = 'sine'
            oscillator2.frequency.setValueAtTime(880, audioContext.currentTime)
            oscillator2.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1)
            
            gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime)
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
            
            oscillator2.start(audioContext.currentTime)
            oscillator2.stop(audioContext.currentTime + 0.4)
        }, 200)
    } catch (error) {
        console.warn('Failed to play completion sound:', error)
    }
}

/**
 * Advanced rest timer hook with sound, vibration, and visual feedback.
 * Provides automatic notifications when timer completes.
 */
export function useRestTimer({ 
    isRunning, 
    isPaused,
    remainingSeconds, 
    durationSeconds,
    tick, 
    onComplete,
    soundEnabled = true,
    vibrationEnabled = true,
}: UseRestTimerParams) {
    const tg = useTelegramWebApp()
    const previousRemainingRef = useRef<number>(remainingSeconds)
    const hasNotifiedRef = useRef<boolean>(false)
    
    // Timer tick interval
    useEffect(() => {
        if (!isRunning || isPaused) return
        
        const interval = window.setInterval(() => {
            tick()
        }, 1000)

        return () => {
            window.clearInterval(interval)
        }
    }, [isRunning, isPaused, tick])
    
    // Check for timer completion and trigger notifications
    useEffect(() => {
        const prevRemaining = previousRemainingRef.current
        previousRemainingRef.current = remainingSeconds
        
        // Timer just completed (went from >0 to 0)
        if (prevRemaining > 0 && remainingSeconds === 0 && !hasNotifiedRef.current) {
            hasNotifiedRef.current = true
            
            // Play sound
            if (soundEnabled) {
                createCompletionSound()
            }
            
            // Trigger vibration via Telegram API
            if (vibrationEnabled && tg.hapticFeedback) {
                // Strong vibration for completion
                tg.hapticFeedback({ type: 'impact', style: 'heavy' })
                
                // Additional vibration pattern
                setTimeout(() => {
                    if (tg.hapticFeedback) {
                        tg.hapticFeedback({ type: 'impact', style: 'medium' })
                    }
                }, 200)
            }
            
            // Call completion callback
            if (onComplete) {
                onComplete()
            }
        }
        
        // Reset notification flag when timer is restarted
        if (remainingSeconds === durationSeconds && durationSeconds > 0) {
            hasNotifiedRef.current = false
        }
        
        // Warning vibration at 3 seconds remaining
        if (remainingSeconds === 3 && prevRemaining === 4 && vibrationEnabled && tg.hapticFeedback) {
            tg.hapticFeedback({ type: 'impact', style: 'light' })
        }
        
    }, [remainingSeconds, durationSeconds, onComplete, soundEnabled, vibrationEnabled, tg])
    
    // Format time as MM:SS
    const formatRestTime = useMemo(() => {
        return (seconds: number): string => {
            const safeSeconds = Math.max(0, seconds)
            const mins = Math.floor(safeSeconds / 60)
            const secs = safeSeconds % 60
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        }
    }, [])
    
    return {
        formatRestTime,
    }
}
