/**
 * SPEC-005 §48: session restore prompt.
 *
 * When an incomplete session exists (draft/active/paused), offer:
 *   Продолжить / Завершить / Отменить
 * - Продолжить  → navigate to the active workout screen.
 * - Завершить   → complete the session with its persisted data.
 * - Отменить    → cancel the session (excluded from analytics, AC-005-026).
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { queryKeys } from '@shared/api/queryKeys'
import { toast } from '@shared/stores/toastStore'
import { useActiveWorkoutSessionDraftStore } from '@/stores/activeWorkoutSessionDraftStore'
import { useAuthStore } from '@/stores/authStore'
import type { WorkoutSessionListItem } from '@features/workouts/types/workouts'

export type RestoreDecision = 'continue' | 'finish' | 'cancel'

export interface UseIncompleteWorkoutCheckResult {
    hasIncompleteWorkout: boolean
    /** Session awaiting a user decision, if any. */
    pendingSession: WorkoutSessionListItem | null
    decide: (decision: RestoreDecision) => Promise<void>
    checkAndRestore: () => Promise<void>
}

export function useIncompleteWorkoutCheck() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const draft = useActiveWorkoutSessionDraftStore((s) => s.draft)
    const clearDraft = useActiveWorkoutSessionDraftStore((s) => s.clearDraft)
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const [pendingSession, setPendingSession] = useState<WorkoutSessionListItem | null>(null)

    const checkAndRestore = useCallback(async () => {
        // Nothing to restore for signed-out users, and no point calling the API.
        if (!useAuthStore.getState().isAuthenticated) {
            setPendingSession(null)
            return
        }

        const localDraft = useActiveWorkoutSessionDraftStore.getState().draft
        try {
            // SPEC-005 §48: ask the server for open sessions first (covers
            // reload on another device); fall back to the local draft.
            const sessions = await workoutsApi.listIncompleteSessions()
            const candidate =
                sessions.find((session) => session.id === localDraft?.workoutId) ??
                sessions[0] ??
                null
            setPendingSession(candidate)
        } catch {
            // Offline: rely on the local draft only.
            if (localDraft?.workoutId) {
                setPendingSession({
                    id: localDraft.workoutId,
                    name: null,
                    status: 'active',
                    date: new Date().toISOString().slice(0, 10),
                    elapsed_seconds: localDraft.elapsedSeconds,
                    exercise_count: localDraft.exercises.length,
                    completed_exercise_count: 0,
                    created_at: new Date(localDraft.startedAt).toISOString(),
                })
            }
        }
    }, [])

    const decide = useCallback(
        async (decision: RestoreDecision) => {
            const session = pendingSession
            setPendingSession(null)
            if (!session) return

            if (decision === 'continue') {
                navigate(`/workouts/active/${session.id}`, { replace: true })
                toast.success('Тренировка восстановлена')
                return
            }

            if (decision === 'cancel') {
                try {
                    await workoutsApi.cancelWorkout(session.id)
                    clearDraft()
                    queryClient.removeQueries({ queryKey: queryKeys.workouts.historyItem(session.id) })
                    toast.info('Тренировка отменена')
                } catch {
                    toast.error('Не удалось отменить тренировку. Попробуйте позже.')
                    setPendingSession(session)
                }
                return
            }

            // decision === 'finish': complete with whatever is persisted.
            try {
                const detail = await workoutsApi.getHistoryItem(session.id)
                const hasSets = detail.exercises.some((exercise) =>
                    exercise.sets_completed.some((set) => set.completed),
                )
                if (!hasSets) {
                    toast.info('В тренировке нет завершённых подходов — она будет отменена')
                    await workoutsApi.cancelWorkout(session.id)
                    clearDraft()
                    return
                }
                await workoutsApi.completeWorkout(session.id, {
                    duration: Math.max(1, Math.round((session.elapsed_seconds ?? 0) / 60) || 1),
                    exercises: detail.exercises,
                    comments: detail.comments ?? undefined,
                    tags: detail.tags ?? [],
                })
                clearDraft()
                toast.success('Тренировка завершена')
                navigate(`/workouts/active/${session.id}/summary`, { replace: true })
            } catch {
                toast.error('Не удалось завершить тренировку. Попробуйте позже.')
                setPendingSession(session)
            }
        },
        [clearDraft, navigate, pendingSession, queryClient],
    )

    useEffect(() => {
        if (!isAuthenticated) return
        void checkAndRestore()
    }, [isAuthenticated, checkAndRestore])

    return {
        hasIncompleteWorkout: pendingSession != null || Boolean(draft?.workoutId),
        pendingSession,
        decide,
        checkAndRestore,
    }
}
