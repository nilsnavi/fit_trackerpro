import { useEffect, useRef } from 'react'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'

/**
 * Automatically persist the active workout state to localStorage.
 * Debounced to avoid thrashing I/O.
 *
 * Call this hook in ActiveWorkoutPage to keep draft in sync with component state.
 */
export function useActiveWorkoutDraftPersist(
  workout: WorkoutHistoryItem | undefined,
  isActiveDraft: boolean,
  elapsedSeconds: number,
  currentExerciseIndex: number,
  currentSetIndex: number,
  restDefaultSeconds: number,
) {
  const updateDraft = useActiveWorkoutSessionDraftStore((state) => state.updateDraft)
  const lastSyncTimeRef = useRef<number>(0)
  const debounceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!workout || !isActiveDraft) return

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = window.setTimeout(() => {
      const now = Date.now()
      if (now - lastSyncTimeRef.current < 200) {
        return
      }

      lastSyncTimeRef.current = now
      updateDraft({
        exercises: workout.exercises,
        elapsedSeconds,
        currentExerciseIndex,
        currentSetIndex,
        comments: workout.comments,
        tags: workout.tags,
        restDefaultSeconds,
        updatedAt: now,
      })
    }, 500)

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [
    currentExerciseIndex,
    currentSetIndex,
    elapsedSeconds,
    isActiveDraft,
    restDefaultSeconds,
    updateDraft,
    workout,
  ])

  useEffect(() => {
    if (!isActiveDraft) return

    const handleBeforeUnload = () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (!workout) return
      updateDraft({
        exercises: workout.exercises,
        elapsedSeconds,
        currentExerciseIndex,
        currentSetIndex,
        comments: workout.comments,
        tags: workout.tags,
        restDefaultSeconds,
        updatedAt: Date.now(),
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      // Only remove the listener — do NOT call handleBeforeUnload() here.
      // Calling it on component unmount (e.g. navigation) would double-save
      // the draft, potentially overwriting newer server state (Bug 2).
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [
    currentExerciseIndex,
    currentSetIndex,
    elapsedSeconds,
    isActiveDraft,
    restDefaultSeconds,
    updateDraft,
    workout,
  ])
}
