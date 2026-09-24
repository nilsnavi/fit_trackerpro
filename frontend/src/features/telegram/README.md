# Telegram Haptic Feedback Module

## 📱 Overview

Universal haptic feedback helper for Telegram Mini App integration. Provides safe, type-safe wrappers for Telegram's HapticFeedback API with graceful fallback for desktop browsers.

## ✨ Features

- **Safe Fallback**: No-op when Telegram WebApp is unavailable (desktop browsers)
- **Type-Safe**: Full TypeScript support with strict mode
- **Event-Driven**: Only triggers in event handlers, never during render
- **Convenience Aliases**: Pre-configured helpers for common scenarios
- **Error Handling**: Silent fail on API errors to prevent app crashes

## 🏗️ Architecture

```
features/telegram/
├── telegramHaptics.ts    # Core implementation
└── index.ts              # Public exports
```

## 🚀 Usage

### Basic Usage

```typescript
import { hapticImpact, hapticNotification } from '@features/telegram'

// In event handler
const handleClick = () => {
  hapticImpact('medium')
  // ... your action logic
}
```

### Convenience Aliases

```typescript
import { 
  hapticSetCompleted,
  hapticButtonPress,
  hapticWorkoutComplete,
  hapticTimerSkip
} from '@features/telegram'

// Set completion
const handleSetComplete = () => {
  hapticSetCompleted() // notificationOccurred("success")
}

// Button press
const handleButtonClick = () => {
  hapticButtonPress() // impactOccurred("medium")
}

// Workout complete
const handleFinish = async () => {
  await completeMutation.mutateAsync()
  hapticWorkoutComplete() // notificationOccurred("success")
}

// Timer skip
const handleSkip = () => {
  hapticTimerSkip() // impactOccurred("light")
}
```

## 📋 API Reference

### Core Functions

#### `hapticImpact(style?: ImpactStyle)`
Triggers impact feedback vibration.

**Parameters:**
- `style`: `'light' | 'medium' | 'heavy' | 'rigid' | 'soft'` (default: `'medium'`)

**Use Cases:**
- `light`: Option selection, tab switching
- `medium`: Button presses, action confirmations
- `heavy`: Important actions (workout completion)
- `rigid/soft`: Special UI patterns

**Example:**
```typescript
hapticImpact('heavy') // Strong vibration for important action
```

---

#### `hapticNotification(type: NotificationType)`
Triggers notification feedback about operation result.

**Parameters:**
- `type`: `'error' | 'success' | 'warning'`

**Use Cases:**
- `success`: Successful action completion
- `error`: Validation or execution error
- `warning`: Warning message

**Example:**
```typescript
hapticNotification('success') // Success notification
```

---

#### `hapticSelection()`
Triggers selection change feedback.

**Use Cases:**
- Switching between sets
- Changing active input
- Toggle completed state

**Example:**
```typescript
const handleToggle = () => {
  hapticSelection()
  toggleSetCompleted()
}
```

---

### Convenience Aliases

#### Set Operations
- `hapticSetCompleted()` - Set successfully completed
- `hapticSetError()` - Set validation error
- `hapticSetSelection()` - Set selection changed

#### Button Interactions
- `hapticButtonPress()` - Medium impact for button press
- `hapticButtonHeavy()` - Heavy impact for important buttons
- `hapticButtonLight()` - Light impact for minor actions

#### Workout Actions
- `hapticWorkoutStart()` - Workout started
- `hapticWorkoutComplete()` - Workout completed successfully
- `hapticWorkoutError()` - Workout error occurred

#### Timer
- `hapticTimerSkip()` - Timer skipped
- `hapticTimerEnd()` - Timer ended

## 🔧 Integration Examples

### 1. SetRow Component

```typescript
import { hapticSelection, hapticSetCompleted, hapticSetError } from '@features/telegram'

export function SetRow({ set, onToggle }: SetRowProps) {
    const handleToggle = () => {
        // Selection feedback
        hapticSelection()
        
        // Toggle logic
        onToggle?.()
        
        // Result feedback
        if (set.completed && set.weight && set.reps) {
            setTimeout(() => hapticSetCompleted(), 50)
        } else if (!set.weight || !set.reps) {
            setTimeout(() => hapticSetError(), 50)
        }
    }
    
    return <div onClick={handleToggle}>...</div>
}
```

### 2. CompleteWorkoutButton Component

```typescript
import { hapticButtonHeavy, hapticWorkoutComplete } from '@features/telegram'

export function CompleteWorkoutButton({ onComplete }: Props) {
    const handleComplete = async () => {
        // Heavy impact on press
        hapticButtonHeavy()
        
        try {
            await onComplete()
            // Success notification after mutation
            hapticWorkoutComplete()
        } catch (error) {
            // Error notification
            hapticWorkoutError()
        }
    }
    
    return <button onClick={handleComplete}>Complete</button>
}
```

### 3. StartWorkoutSheet Component

```typescript
import { hapticButtonLight } from '@features/telegram'

export function StartWorkoutSheet({ onSelectWorkout }: Props) {
    const handleSelect = (type: WorkoutType) => {
        // Light impact on selection
        hapticButtonLight()
        onSelectWorkout(type)
    }
    
    return (
        <button onClick={() => handleSelect('strength')}>
            Strength Training
        </button>
    )
}
```

### 4. RestTimer Component

```typescript
import { hapticTimerSkip, hapticButtonLight } from '@features/telegram'

export function RestTimer({ onSkip }: Props) {
    const handleSkip = () => {
        // Light impact on skip
        hapticTimerSkip()
        onSkip()
    }
    
    const handleStart = () => {
        // Light impact on start
        hapticButtonLight()
        startTimer()
    }
    
    return (
        <>
            <button onClick={handleStart}>Start</button>
            <button onClick={handleSkip}>Skip</button>
        </>
    )
}
```

## ⚠️ Best Practices

### ✅ DO

1. **Call only in event handlers**
   ```typescript
   // ✅ Correct
   const handleClick = () => {
       hapticImpact('medium')
       doSomething()
   }
   ```

2. **Call after successful mutations**
   ```typescript
   // ✅ Correct
   const handleSubmit = async () => {
       await mutation.mutateAsync(data)
       hapticNotification('success')
   }
   ```

3. **Use appropriate intensity**
   ```typescript
   // ✅ Correct hierarchy
   hapticImpact('light')   // Minor interactions
   hapticImpact('medium')  // Standard actions
   hapticImpact('heavy')   // Important actions
   ```

### ❌ DON'T

1. **Never call during render**
   ```typescript
   // ❌ Wrong - causes infinite loop
   function Component() {
       hapticImpact('medium') // Never do this!
       return <div>...</div>
   }
   ```

2. **Don't use in useEffect without dependencies**
   ```typescript
   // ❌ Wrong - triggers on every render
   useEffect(() => {
       hapticImpact('medium')
   })
   
   // ✅ Correct - triggers only on specific changes
   useEffect(() => {
       if (isCompleted) {
           hapticNotification('success')
       }
   }, [isCompleted])
   ```

3. **Don't assume Telegram is available**
   ```typescript
   // ✅ The helper handles this automatically
   hapticImpact('medium') // Safe everywhere
   
   // ❌ Don't do manual checks
   if (window.Telegram?.WebApp) {
       window.Telegram.WebApp.HapticFeedback.impactOccurred('medium')
   }
   ```

## 🧪 Testing

### Desktop Browser Testing

The helper safely falls back to no-op when Telegram is unavailable:

```typescript
// Test in Chrome/Firefox/Safari - should not throw errors
import { hapticImpact } from '@features/telegram'

hapticImpact('medium') // No-op, no console errors
```

### Telegram Mini App Testing

Test on actual device or use Telegram BotFather to create test bot:

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Set up Mini App URL
3. Test haptic feedback on iOS/Android devices

### Unit Tests

```typescript
import { hapticImpact } from '@features/telegram'

describe('hapticImpact', () => {
    it('should not throw in non-Telegram environment', () => {
        expect(() => hapticImpact('medium')).not.toThrow()
    })
    
    it('should call Telegram API when available', () => {
        // Mock Telegram WebApp
        window.Telegram = {
            WebApp: {
                HapticFeedback: {
                    impactOccurred: jest.fn()
                }
            }
        }
        
        hapticImpact('heavy')
        
        expect(window.Telegram.WebApp.HapticFeedback.impactOccurred)
            .toHaveBeenCalledWith('heavy')
    })
})
```

## 🎯 Use Case Matrix

| Action | Function | Intensity | When to Call |
|--------|----------|-----------|--------------|
| Toggle set completed | `hapticSelection()` | selection | On checkbox/input toggle |
| Set validation error | `hapticSetError()` | error | When weight/reps missing |
| Set successfully done | `hapticSetCompleted()` | success | After valid set completion |
| Button press (normal) | `hapticButtonPress()` | medium | Standard button clicks |
| Button press (important) | `hapticButtonHeavy()` | heavy | Finish workout, delete |
| Button press (minor) | `hapticButtonLight()` | light | Tab switches, filters |
| Select workout type | `hapticButtonLight()` | light | Sheet option selection |
| Skip rest timer | `hapticTimerSkip()` | light | Timer skip action |
| Timer finished | `hapticTimerEnd()` | success | Auto timer completion |
| Start workout | `hapticWorkoutStart()` | light | Session initialization |
| Complete workout | `hapticWorkoutComplete()` | success | After successful mutation |
| Workout error | `hapticWorkoutError()` | error | Network/validation error |

## 🔍 Troubleshooting

### No haptic feedback on device

**Possible causes:**
1. Not running in Telegram Mini App
2. Device doesn't support haptics
3. User disabled haptics in settings

**Debug:**
```typescript
// Check if Telegram is available
console.log('Telegram:', !!window.Telegram?.WebApp)
console.log('HapticFeedback:', !!window.Telegram?.WebApp?.HapticFeedback)
```

### Console warnings

You may see warnings like:
```
[Haptic] impactOccurred failed: TypeError: ...
```

This is expected when:
- Running in desktop browser
- Telegram version doesn't support haptics
- API call fails

The helper catches these errors silently to prevent app crashes.

### Different behavior on iOS vs Android

Telegram's haptic implementation varies by platform:
- **iOS**: Uses native Taptic Engine (more subtle)
- **Android**: Uses Android vibrator API (stronger)

This is normal and expected. Design for both experiences.

## 📚 Resources

- [Telegram WebApp API Docs](https://core.telegram.org/bots/webapps#hapticfeedback)
- [Haptic Feedback Guidelines](https://developer.apple.com/design/human-interface-guidelines/haptics)
- [Material Design Haptics](https://material.io/design/communication/haptics.html)

## 🔄 Migration Guide

### From direct API calls

**Before:**
```typescript
// Direct API usage - unsafe
if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium')
}
```

**After:**
```typescript
// Safe wrapper
import { hapticImpact } from '@features/telegram'
hapticImpact('medium')
```

### From custom hooks

**Before:**
```typescript
// Custom hook in each component
function useMyHaptics() {
    const tg = useTelegramWebApp()
    return {
        vibrate: () => tg?.hapticFeedback?.(...)
    }
}
```

**After:**
```typescript
// Universal helper
import { hapticImpact } from '@features/telegram'
hapticImpact('medium')
```

---

**Last Updated**: 2026-05-18  
**Version**: 1.0.0  
**Maintainer**: FitTracker Pro Team
