import { useEffect, useRef } from 'react'

/**
 * Keeps the active set row in view when the cursor moves (exercise / set index).
 * Uses smooth scroll + nearest block to avoid jarring full-page jumps.
 */
export function useScrollCurrentSetIntoView(currentExerciseIndex: number, currentSetIndex: number) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = containerRef.current
        if (!root) return
        const el = root.querySelector<HTMLElement>('[data-testid="set-row"][data-current="true"]')
        if (!el) return
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [currentExerciseIndex, currentSetIndex])

    return containerRef
}
