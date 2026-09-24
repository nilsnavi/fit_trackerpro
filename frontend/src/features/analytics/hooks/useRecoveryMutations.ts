import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { recalculateRecoveryState, type ApiRecoveryStateRecalculateResponse } from '@features/analytics/api/analyticsDomain'

export interface RecalculateRecoveryParams {
    target_date?: string
    date_from?: string
    date_to?: string
}

export function useRecalculateRecoveryMutation() {
    const qc = useQueryClient()

    return useMutation<ApiRecoveryStateRecalculateResponse, Error, RecalculateRecoveryParams>({
        mutationFn: (params) => recalculateRecoveryState(params),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: queryKeys.analytics.recoveryState })
        },
    })
}
