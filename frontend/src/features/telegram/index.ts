/**
 * Telegram Haptic Feedback Module
 * 
 * Re-export всех haptic helpers
 */

export {
    hapticImpact,
    hapticNotification,
    hapticSelection,
    // Convenience aliases
    hapticSetCompleted,
    hapticSetError,
    hapticSetSelection,
    hapticButtonPress,
    hapticButtonHeavy,
    hapticButtonLight,
    hapticWorkoutStart,
    hapticWorkoutComplete,
    hapticWorkoutError,
    hapticTimerSkip,
    hapticTimerEnd,
} from './telegramHaptics'
