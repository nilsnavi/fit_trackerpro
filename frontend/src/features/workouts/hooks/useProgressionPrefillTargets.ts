import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@shared/stores/toastStore'
import { isAppHttpError } from '@shared/errors'
import { progressionApi } from '@shared/api/domains/progressionApi'
import type {
    ProgressionRecommendation,
    ProgressionTargetUpdateRequest,
} from '@features/workouts/types/workouts'
import type { BulkDraftPayload } from '@features/workouts/lib/progressionBulkDraft'
import { allTargetsSuperseded } from '@features/workouts/lib/progressionBulkDraft'
import { PROGRESSION_POLICY_LABELS } from '@features/workouts/lib/progressionTargetDraft'
import { progressionQueryKeys } from '@features/workouts/active/hooks/useProgressionRecommendation'

/**
 * SPEC-006 §58: the settings screen works with the accepted targets and their
 * automatic-prefill state — the backend stays the source of truth, so the list
 * is simply re-read after every change. `declinedOnly` stays available for a
 * narrowed view, but the screen shows every accepted target by default.
 */
export function useProgressionPrefillTargets({ declinedOnly = false }: { declinedOnly?: boolean } = {}) {
    return useQuery({
        queryKey: progressionQueryKeys.prefillList(declinedOnly),
        // The screen shows every accepted scope, so ask for the backend's upper
        // bound instead of silently hiding targets behind the default page size.
        queryFn: () =>
            progressionApi.listPrefillTargets({ declined_only: declinedOnly, limit: 200 }),
        staleTime: 30_000,
    })
}

/**
 * SPEC-006 §58: the chain of bulk switch-offs the server can still undo.
 *
 * Read on every visit: a sweep made on another device — or one this browser no
 * longer remembers — is offered here, and one whose targets were switched back on
 * by hand has simply left its sweep, so it is not offered at all. The whole chain
 * comes back, newest first, which is what lets any link be undone rather than only
 * the last one.
 */
export function useProgressionPrefillSweeps() {
    return useQuery({
        queryKey: progressionQueryKeys.sweeps(),
        queryFn: () => progressionApi.listPrefillSweeps(),
        staleTime: 30_000,
    })
}

function prefillValue(updated: ProgressionRecommendation): string | null {
    const value = updated.actual_selected_value ?? updated.recommended_value
    if (value == null) return null
    return `${value} ${updated.policy === 'TIME_PROGRESSION' ? 'сек' : 'кг'}`
}

/**
 * Say why a prefill switch did nothing, the way the edit path already does.
 *
 * 409 is this screen's «the slot moved on»: the switch belongs to the target that
 * owns the slot now, so flipping it on a row that was replaced is refused instead
 * of silently changing a goal the list has stopped showing. Re-reading the list is
 * what fixes it — the stale row is replaced by the target that owns it now.
 */
function reportPrefillToggleError(
    error: unknown,
    queryClient: ReturnType<typeof useQueryClient>,
    fallback: string,
): void {
    if (isAppHttpError(error) && error.status === 409) {
        toast.error('Цель устарела: слот уже обновлён более новой целью')
        queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        return
    }
    toast.error(fallback)
}

export function useEnableProgressionPrefill() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (recommendationId: number) => progressionApi.enablePrefill(recommendationId),
        onSuccess: (updated) => {
            const value = prefillValue(updated)
            toast.success(
                value == null
                    ? 'Автоподстановка включена снова'
                    : `Снова подставляем ${value}`,
            )
            queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
        onError: (error) =>
            reportPrefillToggleError(
                error,
                queryClient,
                'Не удалось включить автоподстановку',
            ),
    })
}

export function useUpdateProgressionTarget() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            recommendationId,
            payload,
        }: {
            recommendationId: number
            payload: ProgressionTargetUpdateRequest
        }) => progressionApi.updateTarget(recommendationId, payload),
        onSuccess: (updated, variables) => {
            const parts: string[] = []
            const value = updated.actual_selected_value ?? updated.recommended_value
            const timed = (updated.effective_policy ?? updated.policy) === 'TIME_PROGRESSION'
            if (value != null) parts.push(`${value} ${timed ? 'сек' : 'кг'}`)
            // The rep range only belongs in the toast when the edit moved it —
            // otherwise it would just repeat the unchanged default.
            if (variables.payload.reps_min != null && updated.reps_max != null) {
                parts.push(`${updated.reps_min}–${updated.reps_max} повторов`)
            }
            const summary = parts.join(' · ')
            // An edit never flips the prefill switch on its own — say so, so the
            // state stays honest instead of looking like it did nothing.
            const suffix = updated.prefill_declined
                ? ' · автоподстановка выключена'
                : ''
            toast.success(
                summary ? `Цель обновлена: ${summary}${suffix}` : `Цель обновлена${suffix}`,
            )
            queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
        onError: (error) => {
            // 409 is this edit's «the slot moved on»: the target is not the one
            // that owns its scope anymore, so the change is refused instead of
            // landing on a goal the screen stopped showing. Re-reading the list is
            // what fixes it — the row is replaced by the target that owns it now.
            if (isAppHttpError(error) && error.status === 409) {
                toast.error('Цель устарела: слот уже обновлён более новой целью')
                queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
                return
            }
            toast.error('Не удалось сохранить цель')
        },
    })
}

/**
 * SPEC-006 §58: switch the automatic prefill off for many targets at once.
 *
 * ``undefined`` addresses every current target — the rows the screen lists —
 * which is resolved server-side, so «выключить всем» cannot miss a target.
 */
export function useBulkDisableProgressionPrefill() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (recommendationIds?: number[] | null) =>
            progressionApi.bulkDisablePrefill(recommendationIds ?? null),
        onSuccess: (result, recommendationIds) => {
            // Nothing changed: either those goals were off already, or the selection
            // only held records a newer target replaced. The second is not «уже
            // выключена», so it is said out loud instead of looking like a no-op.
            if (result.updated === 0) {
                toast.success(
                    allTargetsSuperseded(result.skipped)
                        ? 'Слот уже обновлён более новой целью'
                        : 'Автоподстановка уже выключена',
                )
            } else if ((recommendationIds ?? []).length > 0) {
                // Счёт по выбранным: сколько из выбранных реально переключилось.
                toast.success(
                    `Выключили подстановку у выбранных (${result.updated} из ${recommendationIds?.length ?? 0})`,
                )
            } else {
                toast.success(`Выключили подстановку у всех целей (${result.updated})`)
            }
            queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
        onError: () => toast.error('Не удалось выключить автоподстановку'),
    })
}

/**
 * SPEC-006 §58: switch the prefill back on for the sweeps a journal link holds.
 *
 * The address is the sweeps themselves, never «всем»: the server resolves what
 * each one still holds, so a goal whose prefill was switched off earlier (or by a
 * different action) stays off, and one call can put the whole chain back.
 */
export function useBulkEnableProgressionPrefill() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (sweepIds: string[]) => progressionApi.bulkEnablePrefill({ sweepIds }),
        onSuccess: (result) => {
            // A sweep address resolves to what it still holds, so «0» can mean the
            // entry only kept goals a newer target replaced — worth saying plainly,
            // because the count alone would read as «уже была включена», and those
            // goals are released from the sweep by this very call.
            if (result.updated === 0 && allTargetsSuperseded(result.skipped)) {
                toast.success('Отменять нечего: слоты уже заняты более новыми целями')
            } else {
                toast.success(
                    result.updated === 0
                        ? 'Автоподстановка уже была включена'
                        : `Вернули автоподстановку (${result.updated})`,
                )
            }
            queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
        onError: () => toast.error('Не удалось вернуть автоподстановку'),
    })
}

/**
 * SPEC-006 §58: apply one policy / rep-range edit to the selected targets.
 *
 * Values and prefill switches are never part of a bulk action — it re-plans the
 * scopes, it does not move today's numbers.
 */
export function useBulkUpdateProgressionTargets() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            recommendationIds,
            payload,
        }: {
            recommendationIds: number[]
            payload: BulkDraftPayload
        }) =>
            progressionApi.bulkUpdateTargets({
                ...payload,
                recommendation_ids: recommendationIds,
            }),
        onSuccess: (result, variables) => {
            const parts: string[] = []
            if (variables.payload.type != null) {
                parts.push(PROGRESSION_POLICY_LABELS[variables.payload.type])
            }
            if (variables.payload.reps_min != null && variables.payload.reps_max != null) {
                parts.push(
                    `${variables.payload.reps_min}–${variables.payload.reps_max} повторов`,
                )
            }
            const summary = parts.length > 0 ? `: ${parts.join(' · ')}` : ''
            const skipped = result.skipped.length > 0 ? ` · пропущено ${result.skipped.length}` : ''
            toast.success(
                result.updated === 0
                    ? allTargetsSuperseded(result.skipped)
                        ? 'Ничего не изменилось — слот уже обновлён более новой целью'
                        : 'Ничего не изменилось — цели не найдены'
                    : `Применили к выбранным (${result.updated})${summary}${skipped}`,
            )
            queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
        onError: () => toast.error('Не удалось применить изменения к целям'),
    })
}

export function useDisableProgressionPrefill() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (recommendationId: number) => progressionApi.disablePrefill(recommendationId),
        onSuccess: (updated) => {
            const value = prefillValue(updated)
            toast.success(
                value == null
                    ? 'Автоподстановка выключена'
                    : `Больше не подставляем ${value} автоматически`,
            )
            queryClient.invalidateQueries({ queryKey: progressionQueryKeys.all })
        },
        onError: (error) =>
            reportPrefillToggleError(
                error,
                queryClient,
                'Не удалось выключить автоподстановку',
            ),
    })
}
