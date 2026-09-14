import type { ReactNode } from 'react'
import { SessionRestoreDialog } from '@features/workouts/components/SessionRestoreDialog'
import { useIncompleteWorkoutCheck } from '@features/workouts/hooks/useIncompleteWorkoutCheck'

/**
 * SPEC-005 §48: mounts the session-restore prompt once per app start.
 * Renders children regardless; the dialog overlays while a decision is pending.
 */
export function IncompleteWorkoutGate({ children }: { children: ReactNode }) {
    const { pendingSession, decide } = useIncompleteWorkoutCheck()

    return (
        <>
            {children}
            <SessionRestoreDialog session={pendingSession} onDecide={(decision) => void decide(decision)} />
        </>
    )
}
