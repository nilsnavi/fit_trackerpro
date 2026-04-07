import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompletedExercise } from '@features/workouts/types/workouts'

/**
 * Full snapshot of an active workout session for persistence.
 * Saved to localStorage to survive browser refresh/crash.
 */
export interface ActiveWorkoutSessionDraft {
  // Identification
  workoutId: number
  templateId?: number | null
  startedAt: number

  // Session state
  exercises: CompletedExercise[]
  elapsedSeconds: number
  currentExerciseIndex: number
  currentSetIndex: number
  comments?: string
  tags?: string[]
  restDefaultSeconds: number

  // Sync tracking
  lastSyncedAt: number
  lastSyncedVersion: number
  lastSyncedPayload?: string // JSON snapshot for change detection

  // Idempotency: track which operations we've queued
  pendingOperationIds: string[] // idempotency keys of queued ops

  // Metadata
  createdAt: number
  updatedAt: number
}

interface ActiveWorkoutSessionDraftStore {
  draft: ActiveWorkoutSessionDraft | null

  /**
   * Initialize or update the draft with full session state.
   * Typically called after loading workout from API and hydrating local changes.
   */
  initializeDraft: (data: ActiveWorkoutSessionDraft) => void

  /**
   * Update specific fields (partial) in the draft.
   * Used for incremental updates during session (exercises, elapsed, position).
   */
  updateDraft: (updates: Partial<ActiveWorkoutSessionDraft>) => void

  /**
   * Mark a sync operation as pending (queued).
   * Prevents replay if operation hasn't cleared yet.
   */
  addPendingOperation: (idempotencyKey: string) => void

  /**
   * Remove from pending ops (operation synced successfully).
   */
  removePendingOperation: (idempotencyKey: string) => void

  /**
   * Update after successful server sync.
   * Sets lastSyncedAt, lastSyncedVersion, clears pending ops if version confirms sync.
   */
  markSyncedAt: (serverVersion: number, serverPayload: string) => void

  /**
   * Restore draft from storage (called on page mount if exists).
   */
  getDraft: () => ActiveWorkoutSessionDraft | null

  /**
   * Clear draft entirely (after workout complete or abandoned).
   */
  clearDraft: () => void
}

const createInitialDraft = (): ActiveWorkoutSessionDraft | null => null

export const useActiveWorkoutSessionDraftStore = create<ActiveWorkoutSessionDraftStore>()(
  persist(
    (set, get) => ({
      draft: createInitialDraft(),

      initializeDraft: (data) =>
        set({
          draft: {
            ...data,
            updatedAt: Date.now(),
          },
        }),

      updateDraft: (updates) =>
        set((state) => {
          if (!state.draft) return state

          return {
            draft: {
              ...state.draft,
              ...updates,
              updatedAt: Date.now(),
            },
          }
        }),

      addPendingOperation: (idempotencyKey) =>
        set((state) => {
          if (!state.draft) return state
          const existingOps = new Set(state.draft.pendingOperationIds)
          existingOps.add(idempotencyKey)

          return {
            draft: {
              ...state.draft,
              pendingOperationIds: Array.from(existingOps),
              updatedAt: Date.now(),
            },
          }
        }),

      removePendingOperation: (idempotencyKey) =>
        set((state) => {
          if (!state.draft) return state
          const existingOps = new Set(state.draft.pendingOperationIds)
          existingOps.delete(idempotencyKey)

          return {
            draft: {
              ...state.draft,
              pendingOperationIds: Array.from(existingOps),
              updatedAt: Date.now(),
            },
          }
        }),

      markSyncedAt: (serverVersion, serverPayload) =>
        set((state) => {
          if (!state.draft) return state

          return {
            draft: {
              ...state.draft,
              lastSyncedAt: Date.now(),
              lastSyncedVersion: serverVersion,
              lastSyncedPayload: serverPayload,
              updatedAt: Date.now(),
            },
          }
        }),

      getDraft: () => get().draft,

      clearDraft: () =>
        set({
          draft: null,
        }),
    }),
    {
      name: 'active-workout-session-draft',
      // Only persist draft, not other state
      partialize: (state) => ({
        draft: state.draft,
      }),
    },
  ),
)
