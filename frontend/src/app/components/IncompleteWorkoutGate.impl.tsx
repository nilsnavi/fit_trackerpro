import { Suspense, lazy } from 'react'
import { useIncompleteWorkoutCheck } from '@features/workouts/hooks/useIncompleteWorkoutCheck'

/**
 * The dialog markup is only needed once an unfinished session was found, so it is
 * split out of the restore chunk as well.
 */
const SessionRestoreDialog = lazy(() =>
    import('@features/workouts/components/SessionRestoreDialog').then((module) => ({
        default: module.SessionRestoreDialog,
    })),
)

/** SPEC-005 §48: detects an unfinished session once per app start and overlays the prompt. */
export function IncompleteWorkoutGateImpl() {
    const { pendingSession, decide } = useIncompleteWorkoutCheck()

    if (!pendingSession) return null

    return (
        <Suspense fallback={null}>
            <SessionRestoreDialog
                session={pendingSession}
                onDecide={(decision) => void decide(decision)}
            />
        </Suspense>
    )
}
