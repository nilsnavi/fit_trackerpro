import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { UNSAFE_NavigationContext } from 'react-router-dom'

interface UseUnsavedChangesGuardOptions {
    isDirty: boolean
    onConfirmedLeave?: () => void
    enableRouteBlock?: boolean
}

interface BlockableNavigator {
    push?: (...args: unknown[]) => void
    replace?: (...args: unknown[]) => void
    go?: (delta: number) => void
}

interface UseUnsavedChangesGuardResult {
    /** Whether to show the UnsavedChangesModal */
    isConfirmOpen: boolean
    /**
     * Wraps a navigation/action callback with the guard.
     * If the editor is dirty, shows the modal.
     * If clean, executes `action` immediately.
     */
    guardedAction: (action: () => void) => void
    onLeave: () => void
    onStay: () => void
}

/**
 * Manages the unsaved-changes confirmation flow.
 *
 * Usage:
 * ```tsx
 * const { isConfirmOpen, guardedAction, onLeave, onStay } = useUnsavedChangesGuard({ isDirty })
 *
 * // Guard any navigation/back action:
 * <button onClick={() => guardedAction(() => navigate('/workouts'))}>Назад</button>
 *
 * <UnsavedChangesModal isOpen={isConfirmOpen} onLeave={onLeave} onStay={onStay} />
 * ```
 */
export function useUnsavedChangesGuard({
    isDirty,
    onConfirmedLeave,
    enableRouteBlock = false,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const pendingActionRef = useRef<(() => void) | null>(null)
    const navigationContext = useContext(UNSAFE_NavigationContext)

    const guardedAction = useCallback(
        (action: () => void) => {
            if (!isDirty) {
                action()
                return
            }
            pendingActionRef.current = action
            setIsConfirmOpen(true)
        },
        [isDirty],
    )

    const onLeave = useCallback(() => {
        setIsConfirmOpen(false)
        onConfirmedLeave?.()
        pendingActionRef.current?.()
        pendingActionRef.current = null
    }, [onConfirmedLeave])

    const onStay = useCallback(() => {
        setIsConfirmOpen(false)
        pendingActionRef.current = null
    }, [])

    useEffect(() => {
        if (!enableRouteBlock || !isDirty) {
            return
        }

        const navigator = navigationContext.navigator as BlockableNavigator
        const originalPush = navigator.push?.bind(navigator)
        const originalReplace = navigator.replace?.bind(navigator)
        const originalGo = navigator.go?.bind(navigator)

        if (originalPush) {
            navigator.push = (...args: unknown[]) => {
                pendingActionRef.current = () => originalPush(...args)
                setIsConfirmOpen(true)
            }
        }

        if (originalReplace) {
            navigator.replace = (...args: unknown[]) => {
                pendingActionRef.current = () => originalReplace(...args)
                setIsConfirmOpen(true)
            }
        }

        if (originalGo) {
            navigator.go = (delta: number) => {
                pendingActionRef.current = () => originalGo(delta)
                setIsConfirmOpen(true)
            }
        }

        return () => {
            if (originalPush) {
                navigator.push = originalPush
            }
            if (originalReplace) {
                navigator.replace = originalReplace
            }
            if (originalGo) {
                navigator.go = originalGo
            }
        }
    }, [enableRouteBlock, isDirty, navigationContext])

    return { isConfirmOpen, guardedAction, onLeave, onStay }
}
