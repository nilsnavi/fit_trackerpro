import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'

import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { isRecoverableSyncError } from '@shared/offline/syncQueue'
import { enqueueOfflineWorkoutSetUpdate } from '@shared/offline/workoutOfflineEnqueue'
import { toast } from '@shared/stores/toastStore'
import { useWorkoutSessionUiStore } from '@/state/local'
import type {
    CompletedExercise,
    CompletedSet,
    WorkoutSetPatchRequest,
    WorkoutSetResponse,
} from '@features/workouts/types/workouts'
import { DEFAULT_TIMED_SET_SECONDS, isTimedSet } from '../lib/activeWorkoutUtils'

/** SPEC-005 §17: rest between sets, когда ни план, ни факт его не несут. */
const DEFAULT_REST_SECONDS = 90

type UpdateSetFn = (exerciseIndex: number, setNumber: number, patch: Partial<CompletedSet>) => void

function getRestSeconds(exercise: CompletedExercise): number {
    const planned = exercise.sets_completed.find((set) => typeof set.planned_rest_seconds === 'number')?.planned_rest_seconds
    const tracked = exercise.sets_completed.find((set) => typeof set.rest_seconds === 'number')?.rest_seconds
    return planned ?? tracked ?? DEFAULT_REST_SECONDS
}

/**
 * Поля, которые добирает ответ сервера. `completed` в них не входит никогда: подход завершён
 * локально, и эхо запроса, отправленного раньше этой правки, не должно его откатывать.
 */
export function serverSetPatch(
    saved: WorkoutSetResponse,
    fallback: { weight?: number; duration?: number },
): Partial<CompletedSet> {
    return {
        id: saved.id,
        weight: saved.weight ?? fallback.weight,
        reps: saved.reps == null ? undefined : Number(saved.reps),
        duration: saved.duration == null ? fallback.duration : Number(saved.duration),
        rpe: saved.rpe == null ? undefined : Number(saved.rpe),
        rest_seconds: saved.rest_seconds ?? undefined,
        notes: saved.notes ?? undefined,
    }
}

export interface UseCompleteWorkoutSetParams {
    workoutId: number
    exercise: CompletedExercise
    exerciseIndex: number
    exercises: CompletedExercise[]
    onUpdateSet: UpdateSetFn
    onSetLastCompletedSet: (payload: { exerciseIndex: number; setNumber: number } | null) => void
    onSetCurrentPosition: (exerciseIndex: number, setIndex: number) => void
    onSelectExercise: (exerciseIndex: number) => void
    onNotifySetCompleted: () => void
    /** Валидация подхода: сообщение об ошибке или `null`, когда проверки прошли. */
    onCompletionError: (message: string | null) => void
    /** Ответ по подходу слит с состоянием: следующий подход может захотеть свежую рекомендацию. */
    onSetSaved?: (nextSet?: CompletedSet) => void
}

/**
 * SPEC-005 §11/§17: завершение подхода — единственный владелец записи подхода и следствий
 * завершения. Рядок становится выполненным локально и сразу, а сама запись уходит следом:
 * при восстановимой ошибке она встаёт в офлайн-очередь, а успешный ответ добирает только
 * серверные поля (см. `serverSetPatch`).
 */
export function useCompleteWorkoutSet({
    workoutId,
    exercise,
    exerciseIndex,
    exercises,
    onUpdateSet,
    onSetLastCompletedSet,
    onSetCurrentPosition,
    onSelectExercise,
    onNotifySetCompleted,
    onCompletionError,
    onSetSaved,
}: UseCompleteWorkoutSetParams) {
    const startRest = useWorkoutSessionUiStore((s) => s.startSessionRestTimer)

    const completeSetMutation = useMutation({
        mutationFn: async ({ setId, weight, reps, duration, rpe }: {
            setId: number
            weight: number
            reps?: number
            /** SPEC-005 §20: timed sets send duration instead of reps. */
            duration?: number
            rpe?: number
        }): Promise<WorkoutSetResponse> => {
            const body: WorkoutSetPatchRequest = {
                weight,
                ...(typeof duration === 'number' ? { duration } : { reps: reps ?? 0 }),
                ...(typeof rpe === 'number' ? { rpe } : {}),
                completed: true,
            }
            try {
                return await workoutsApi.patchWorkoutSet(workoutId, setId, body)
            } catch (error) {
                // Нет сети — запись подхода встаёт в офлайн-очередь и уйдёт при восстановлении.
                if (isRecoverableSyncError(error)) {
                    enqueueOfflineWorkoutSetUpdate(workoutId, setId, body)
                }
                throw error
            }
        },
    })

    const completeSet = useCallback(
        async (set: CompletedSet) => {
            if (set.completed) return
            onCompletionError(null)

            // SPEC-005 §20: timed sets validate duration instead of reps.
            const isTimed = isTimedSet(set)
            const isWarmup = set.set_type === 'warmup'

            const weight = typeof set.weight === 'number' ? set.weight : Number.NaN
            const reps = typeof set.reps === 'number' ? set.reps : Number.NaN
            if (!isTimed && (!Number.isFinite(weight) || weight <= 0) && !isWarmup) {
                onCompletionError('Заполните вес больше 0')
                return
            }
            if (!isTimed && (!Number.isFinite(reps) || reps <= 0)) {
                onCompletionError('Заполните повторы больше 0')
                return
            }
            if (isTimed && (!Number.isFinite(set.duration) || (set.duration ?? 0) <= 0)) {
                onCompletionError('Заполните длительность больше 0')
                return
            }
            if (typeof set.id !== 'number' || set.id <= 0) {
                onCompletionError('Не удалось сохранить подход: отсутствует id set')
                return
            }

            // SPEC-005 §11/§17: подход завершается локально — рядок, отдых и следующий подход
            // не ждут сети; запись уходит следом и при отсутствии сети встаёт в офлайн-очередь
            // (см. `completeSetMutation`).
            onUpdateSet(exerciseIndex, set.set_number, {
                completed: true,
                completed_at: new Date().toISOString(),
            })
            onSetLastCompletedSet({ exerciseIndex, setNumber: set.set_number })

            const nextSet = exercise.sets_completed[set.set_number]
            if (nextSet) {
                // SPEC-005 §11: prefill next set from the previous working set.
                const prefillSource = isWarmup ? (exercise.sets_completed.find((s) => s.set_type !== 'warmup') ?? set) : set
                onUpdateSet(exerciseIndex, nextSet.set_number, isTimed
                    // SPEC-005 §20: a timed set prefill copies duration, not reps.
                    ? { duration: prefillSource.duration ?? DEFAULT_TIMED_SET_SECONDS, reps: undefined }
                    : { weight: prefillSource.weight, reps: prefillSource.reps })
                onSetCurrentPosition(exerciseIndex, set.set_number)
                // SPEC-005 §17: rest timer starts after every completed set;
                // the PR check and warm-up exclusion happen server-side.
                startRest({
                    forExerciseId: `${exercise.exercise_id}-${exerciseIndex}`,
                    exerciseIndex,
                    exerciseName: exercise.name,
                    nextSetOrdinal: nextSet.set_number,
                    totalSets: exercise.sets_completed.length,
                    total: getRestSeconds(exercise),
                })
            } else {
                const nextExerciseIndex = exercises.findIndex((_, index) => index > exerciseIndex)
                if (nextExerciseIndex >= 0) {
                    onSetCurrentPosition(nextExerciseIndex, 0)
                    onSelectExercise(nextExerciseIndex)
                } else {
                    toast.success('Все упражнения выполнены')
                }
            }

            onNotifySetCompleted()

            try {
                const saved = await completeSetMutation.mutateAsync({
                    setId: set.id,
                    // Warm-up may legitimately have empty weight (bodyweight).
                    weight: Number.isFinite(weight) ? weight : 0,
                    // SPEC-005 §20: timed sets persist duration and no reps.
                    ...(isTimed ? { duration: set.duration } : { reps }),
                    rpe: typeof set.rpe === 'number' ? set.rpe : undefined,
                })

                onUpdateSet(exerciseIndex, saved.set_number, serverSetPatch(saved, {
                    weight: Number.isFinite(weight) ? weight : undefined,
                    duration: set.duration,
                }))
                if (nextSet && !isWarmup) {
                    onSetSaved?.(nextSet)
                }
            } catch {
                // Рядок уже завершён локально, а подходы принадлежат сессии: её синхронизация
                // (в том числе офлайн-очередь) несёт завершение на сервер, поэтому откатывать
                // рядок нечего — ответ подхода добирает только серверные поля.
            }
        },
        [
            completeSetMutation,
            exercise,
            exerciseIndex,
            exercises,
            onCompletionError,
            onNotifySetCompleted,
            onSelectExercise,
            onSetCurrentPosition,
            onSetLastCompletedSet,
            onSetSaved,
            onUpdateSet,
            startRest,
        ],
    )

    return { completeSet }
}
