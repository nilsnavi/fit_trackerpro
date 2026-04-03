import { useCallback, useRef, useState } from 'react'

interface UseUnsavedChangesGuardOptions {
    isDirty: boolean
    onConfirmedLeave?: () => void
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
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const pendingActionRef = useRef<(() => void) | null>(null)

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

    return { isConfirmOpen, guardedAction, onLeave, onStay }
}
