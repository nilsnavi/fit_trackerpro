import { useEffect, useState, type ComponentType } from 'react'

/**
 * SPEC-005 §48: the restore prompt is only ever shown when an unfinished session
 * exists, so both the detection hook and the dialog live in a separate chunk and
 * are pulled in after the shell renders (entry bundle budget).
 *
 * A failed chunk fetch is not fatal: the prompt is optional, the app keeps working.
 */
export function IncompleteWorkoutGate() {
    const [RestorePrompt, setRestorePrompt] = useState<ComponentType | null>(null)

    useEffect(() => {
        let cancelled = false
        void import('./IncompleteWorkoutGate.impl')
            .then((module) => {
                if (!cancelled) setRestorePrompt(() => module.IncompleteWorkoutGateImpl)
            })
            .catch(() => {
                // Prompt unavailable (offline chunk fetch); nothing to restore visually.
            })
        return () => {
            cancelled = true
        }
    }, [])

    return RestorePrompt ? <RestorePrompt /> : null
}
